"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import {
  deriveKEK,
  generateDEK,
  wrapDEK,
  unwrapDEK,
  generateSalt,
  createVerificationPayload,
  verifyDEK,
} from "../lib/crypto";
import {
  getJournalSettings,
  saveJournalSettings,
  getJournalKeyRecord,
  saveJournalKeyRecord,
  updateAutoLockMinutes,
} from "../actions";
import { JournalSettingsRecord, JournalKeyRecord } from "@/db/schema";

import { getBrowserCache, setBrowserCache } from "@/lib/client-cache";

interface JournalAuthContextType {
  isUnlocked: boolean;
  isConfigured: boolean;
  loading: boolean;
  cryptoKey: CryptoKey | null; // This is the decrypted DEK in memory
  settings: JournalSettingsRecord | null;
  keyRecord: JournalKeyRecord | null;
  unlock: (password: string) => Promise<boolean>;
  lock: () => void;
  setupPassword: (password: string, autoLockMinutes?: number) => Promise<boolean>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
  updateAutoLock: (minutes: number) => Promise<void>;
}

const JournalAuthContext = createContext<JournalAuthContextType | null>(null);

export function JournalAuthProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<JournalSettingsRecord | null>(() => {
    const cached = getBrowserCache<{ settings: JournalSettingsRecord | null }>("journal_config_cache");
    return cached?.settings || null;
  });
  const [keyRecord, setKeyRecord] = useState<JournalKeyRecord | null>(() => {
    const cached = getBrowserCache<{ keyRecord: JournalKeyRecord | null }>("journal_config_cache");
    return cached?.keyRecord || null;
  });
  const [loading, setLoading] = useState<boolean>(() => {
    const cached = getBrowserCache<{ keyRecord: any; settings: any }>("journal_config_cache");
    return !cached;
  });

  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null); // In-memory DEK
  const [isUnlocked, setIsUnlocked] = useState(false);
  const lockTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchConfiguration = useCallback(async () => {
    try {
      const [sRes, kRes] = await Promise.all([
        getJournalSettings(),
        getJournalKeyRecord(),
      ]);
      setSettings(sRes);
      setKeyRecord(kRes);
      setBrowserCache("journal_config_cache", { settings: sRes, keyRecord: kRes });
    } catch (err) {
      console.error("Error loading journal encryption config:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfiguration();
  }, [fetchConfiguration]);

  const lock = useCallback(() => {
    setCryptoKey(null);
    setIsUnlocked(false);
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }
  }, []);

  const resetLockTimer = useCallback(() => {
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }

    const minutes = settings?.autoLockMinutes ?? 15;
    if (minutes > 0 && isUnlocked) {
      lockTimerRef.current = setTimeout(() => {
        lock();
      }, minutes * 60 * 1000);
    }
  }, [settings?.autoLockMinutes, isUnlocked, lock]);

  // Activity listeners to reset auto lock timer
  useEffect(() => {
    if (!isUnlocked || !settings?.autoLockMinutes || settings.autoLockMinutes <= 0) return;

    resetLockTimer();

    const handleUserActivity = () => {
      resetLockTimer();
    };

    window.addEventListener("mousemove", handleUserActivity);
    window.addEventListener("keydown", handleUserActivity);
    window.addEventListener("click", handleUserActivity);

    return () => {
      window.removeEventListener("mousemove", handleUserActivity);
      window.removeEventListener("keydown", handleUserActivity);
      window.removeEventListener("click", handleUserActivity);
      if (lockTimerRef.current) {
        clearTimeout(lockTimerRef.current);
      }
    };
  }, [isUnlocked, settings?.autoLockMinutes, resetLockTimer]);

  // Lock on window unload
  useEffect(() => {
    const handleUnload = () => {
      setCryptoKey(null);
      setIsUnlocked(false);
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, []);

  const unlock = async (password: string): Promise<boolean> => {
    if (!keyRecord || !settings) return false;
    try {
      // 1. Derive KEK via Argon2id
      const kek = await deriveKEK(password, keyRecord.salt, {
        memorySize: keyRecord.argonMemory,
        iterations: keyRecord.argonIterations,
        parallelism: keyRecord.argonParallelism,
      });

      // 2. Unwrap DEK using KEK
      const dek = await unwrapDEK(keyRecord.encryptedDek, keyRecord.iv, kek);

      // 3. Verify DEK against verification payload
      const isValid = await verifyDEK(dek, settings.verificationPayload, settings.verificationIv);
      if (isValid) {
        setCryptoKey(dek);
        setIsUnlocked(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Unlock error:", err);
      return false;
    }
  };

  const setupPassword = async (password: string, autoLockMinutes: number = 15): Promise<boolean> => {
    try {
      // 1. Generate random DEK
      const dek = await generateDEK();

      // 2. Derive KEK from password using Argon2id
      const salt = generateSalt();
      const kek = await deriveKEK(password, salt);

      // 3. Wrap DEK using KEK
      const { encryptedDek, iv } = await wrapDEK(dek, kek);

      // 4. Save journal_keys record
      const savedKeyRecord = await saveJournalKeyRecord({
        encryptedDek,
        salt,
        iv,
        algorithm: "AES-256-GCM",
        kdf: "Argon2id",
        argonMemory: 65536,
        argonIterations: 3,
        argonParallelism: 1,
        keyVersion: 1,
      });

      // 5. Create verification payload with DEK and save journal_settings
      const { verificationPayload, verificationIv } = await createVerificationPayload(dek);
      const savedSettings = await saveJournalSettings({
        salt,
        verificationPayload,
        verificationIv,
        autoLockMinutes,
      });

      setKeyRecord(savedKeyRecord);
      setSettings(savedSettings);
      setCryptoKey(dek);
      setIsUnlocked(true);
      return true;
    } catch (err) {
      console.error("Password setup error:", err);
      return false;
    }
  };

  /**
   * Instantly re-wraps DEK with new password-derived KEK without re-encrypting journal entries.
   */
  const changePassword = async (oldPassword: string, newPassword: string): Promise<boolean> => {
    if (!keyRecord || !cryptoKey) return false;
    try {
      // 1. Derive old KEK to verify old password
      const oldKek = await deriveKEK(oldPassword, keyRecord.salt, {
        memorySize: keyRecord.argonMemory,
        iterations: keyRecord.argonIterations,
        parallelism: keyRecord.argonParallelism,
      });

      const dekCheck = await unwrapDEK(keyRecord.encryptedDek, keyRecord.iv, oldKek);
      if (!dekCheck) return false;

      // 2. Derive new KEK for new password
      const newSalt = generateSalt();
      const newKek = await deriveKEK(newPassword, newSalt, {
        memorySize: keyRecord.argonMemory,
        iterations: keyRecord.argonIterations,
        parallelism: keyRecord.argonParallelism,
      });

      // 3. Re-wrap existing DEK (in memory cryptoKey) with new KEK
      const { encryptedDek: newEncryptedDek, iv: newIv } = await wrapDEK(cryptoKey, newKek);

      // 4. Save updated journal_keys record (Journal entries are 100% UNTOUCHED!)
      const updatedKeyRecord = await saveJournalKeyRecord({
        encryptedDek: newEncryptedDek,
        salt: newSalt,
        iv: newIv,
      });

      setKeyRecord(updatedKeyRecord);
      return true;
    } catch (err) {
      console.error("Password change error:", err);
      return false;
    }
  };

  const updateAutoLock = async (minutes: number) => {
    await updateAutoLockMinutes(minutes);
    setSettings((prev) => (prev ? { ...prev, autoLockMinutes: minutes } : null));
  };

  return (
    <JournalAuthContext.Provider
      value={{
        isUnlocked,
        isConfigured: Boolean(keyRecord && settings),
        loading,
        cryptoKey,
        settings,
        keyRecord,
        unlock,
        lock,
        setupPassword,
        changePassword,
        updateAutoLock,
      }}
    >
      {children}
    </JournalAuthContext.Provider>
  );
}

export function useJournalAuth() {
  const context = useContext(JournalAuthContext);
  if (!context) {
    throw new Error("useJournalAuth must be used within a JournalAuthProvider");
  }
  return context;
}
