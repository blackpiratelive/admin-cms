package com.personal.cms.journal.data.crypto

import android.content.Context
import android.util.Base64
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import javax.crypto.SecretKey
import javax.crypto.spec.SecretKeySpec

class KeystoreManager(context: Context) {

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val sharedPreferences = EncryptedSharedPreferences.create(
        context,
        "secure_journal_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    var activeDEK: SecretKey? = null

    fun getBaseUrl(): String? {
        return sharedPreferences.getString("cms_base_url", null)
    }

    fun setBaseUrl(url: String) {
        val cleanUrl = url.trim().trimEnd('/')
        sharedPreferences.edit().putString("cms_base_url", cleanUrl).apply()
    }

    fun getAuthToken(): String? {
        return sharedPreferences.getString("auth_token", null)
    }

    fun setAuthToken(token: String?) {
        if (token == null) {
            sharedPreferences.edit().remove("auth_token").apply()
        } else {
            sharedPreferences.edit().putString("auth_token", token).apply()
        }
    }

    fun saveEncryptedDEK(dek: SecretKey) {
        val encoded = Base64.encodeToString(dek.encoded, Base64.NO_WRAP)
        sharedPreferences.edit().putString("encrypted_dek_cached", encoded).apply()
        activeDEK = dek
    }

    fun getCachedDEK(): SecretKey? {
        val encoded = sharedPreferences.getString("encrypted_dek_cached", null) ?: return null
        return try {
            val bytes = Base64.decode(encoded, Base64.NO_WRAP)
            SecretKeySpec(bytes, "AES")
        } catch (e: Exception) {
            null
        }
    }

    fun isBiometricEnabled(): Boolean {
        return sharedPreferences.getBoolean("biometric_enabled", false)
    }

    fun setBiometricEnabled(enabled: Boolean) {
        sharedPreferences.edit().putBoolean("biometric_enabled", enabled).apply()
    }

    fun clearSession() {
        activeDEK = null
        sharedPreferences.edit()
            .remove("auth_token")
            .remove("encrypted_dek_cached")
            .apply()
    }

    fun clearAll() {
        activeDEK = null
        sharedPreferences.edit().clear().apply()
    }
}
