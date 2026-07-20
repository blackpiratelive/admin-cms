package com.personal.cms.journal.data.repository

import android.content.Context
import com.personal.cms.journal.data.crypto.CryptoEngine
import com.personal.cms.journal.data.crypto.KeystoreManager
import com.personal.cms.journal.data.remote.JournalApiService
import com.personal.cms.journal.data.remote.dto.KeyRecordDto
import com.personal.cms.journal.data.remote.dto.SettingsRecordDto
import javax.crypto.SecretKey

sealed class AuthResult {
    object Success : AuthResult()
    data class Error(val message: String) : AuthResult()
}

class AuthRepository(
    context: Context
) {
    private val keystoreManager = KeystoreManager(context)
    private val apiService = JournalApiService()

    suspend fun validateInstance(baseUrl: String): Boolean {
        return try {
            val status = apiService.checkStatus(baseUrl.trim().trimEnd('/'))
            status.status == "ok" && status.module == "journal"
        } catch (e: Exception) {
            false
        }
    }

    suspend fun login(password: String): AuthResult {
        val baseUrl = keystoreManager.getBaseUrl() ?: return AuthResult.Error("Base URL not set")
        return try {
            val response = apiService.login(baseUrl, password)
            if (response.success && response.token != null) {
                keystoreManager.setAuthToken(response.token)
                AuthResult.Success
            } else {
                AuthResult.Error(response.error ?: "Invalid password")
            }
        } catch (e: Exception) {
            AuthResult.Error(e.message ?: "Network error during authentication")
        }
    }

    suspend fun unlockJournalWithPassword(journalPassword: String): AuthResult {
        val baseUrl = keystoreManager.getBaseUrl() ?: return AuthResult.Error("Base URL not set")
        val token = keystoreManager.getAuthToken() ?: return AuthResult.Error("Not authenticated")

        return try {
            val keysResp = apiService.getKeys(baseUrl, token)
            val keyRecord = keysResp.keys ?: return AuthResult.Error("Journal keys not set up on server")

            val kek = CryptoEngine.deriveKEK(
                password = journalPassword,
                saltBase64 = keyRecord.salt,
                memoryKb = keyRecord.argonMemory,
                iterations = keyRecord.argonIterations,
                parallelism = keyRecord.argonParallelism
            )

            val dek = CryptoEngine.unwrapDEK(
                encryptedDekBase64 = keyRecord.encryptedDek,
                ivBase64 = keyRecord.iv,
                kekKey = kek
            )

            val settingsResp = apiService.getSettings(baseUrl, token)
            val settingsRecord = settingsResp.settings

            if (settingsRecord != null) {
                val isValid = CryptoEngine.verifyDEK(
                    dekKey = dek,
                    verificationPayloadBase64 = settingsRecord.verificationPayload,
                    verificationIvBase64 = settingsRecord.verificationIv
                )
                if (!isValid) {
                    return AuthResult.Error("Incorrect Journal Password")
                }
            }

            keystoreManager.saveEncryptedDEK(dek)
            AuthResult.Success
        } catch (e: Exception) {
            e.printStackTrace()
            AuthResult.Error(e.message ?: "Failed to unlock journal")
        }
    }

    suspend fun setupNewJournalPassword(journalPassword: String): AuthResult {
        val baseUrl = keystoreManager.getBaseUrl() ?: return AuthResult.Error("Base URL not set")
        val token = keystoreManager.getAuthToken() ?: return AuthResult.Error("Not authenticated")

        return try {
            val salt = CryptoEngine.generateSalt()
            val kek = CryptoEngine.deriveKEK(journalPassword, salt)
            val dek = CryptoEngine.generateDEK()

            val (encryptedDek, iv) = CryptoEngine.wrapDEK(dek, kek)
            val keyRecord = KeyRecordDto(
                encryptedDek = encryptedDek,
                salt = salt,
                iv = iv,
                argonMemory = 65536,
                argonIterations = 3,
                argonParallelism = 1
            )
            apiService.saveKeys(baseUrl, token, keyRecord)

            val (vPayload, vIv) = CryptoEngine.encryptText("VERIFIED_JOURNAL_KEY", dek)
            val settingsRecord = SettingsRecordDto(
                salt = salt,
                verificationPayload = vPayload,
                verificationIv = vIv,
                autoLockMinutes = 15
            )
            apiService.saveSettings(baseUrl, token, settingsRecord)

            keystoreManager.saveEncryptedDEK(dek)
            AuthResult.Success
        } catch (e: Exception) {
            AuthResult.Error(e.message ?: "Failed to set up journal password")
        }
    }

    fun isUnlocked(): Boolean {
        return keystoreManager.activeDEK != null || keystoreManager.getCachedDEK() != null
    }

    fun logout() {
        keystoreManager.clearSession()
    }
}
