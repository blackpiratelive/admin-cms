package com.personal.cms.journal.data.crypto

import android.util.Base64
import org.bouncycastle.crypto.generators.Argon2BytesGenerator
import org.bouncycastle.crypto.params.Argon2Parameters
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

object CryptoEngine {

    private val secureRandom = SecureRandom()

    fun generateSalt(): String {
        val salt = ByteArray(16)
        secureRandom.nextBytes(salt)
        return Base64.encodeToString(salt, Base64.NO_WRAP)
    }

    fun generateIv(): String {
        val iv = ByteArray(12) // 96-bit IV for AES-GCM
        secureRandom.nextBytes(iv)
        return Base64.encodeToString(iv, Base64.NO_WRAP)
    }

    fun generateRawIv(): ByteArray {
        val iv = ByteArray(12)
        secureRandom.nextBytes(iv)
        return iv
    }

    fun deriveKEK(
        password: String,
        saltBase64: String,
        memoryKb: Int = 65536,
        iterations: Int = 3,
        parallelism: Int = 1
    ): SecretKey {
        val saltBytes = Base64.decode(saltBase64, Base64.NO_WRAP)
        val params = Argon2Parameters.Builder(Argon2Parameters.ARGON2_id)
            .withVersion(Argon2Parameters.ARGON2_VERSION_13)
            .withMemoryAsKB(memoryKb)
            .withIterations(iterations)
            .withParallelism(parallelism)
            .withSalt(saltBytes)
            .build()

        val generator = Argon2BytesGenerator()
        generator.init(params)
        val kekBytes = ByteArray(32) // 256 bits
        generator.generateBytes(password.toByteArray(Charsets.UTF_8), kekBytes, 0, kekBytes.size)

        val secretKey = SecretKeySpec(kekBytes, "AES")
        kekBytes.fill(0)
        return secretKey
    }

    fun generateDEK(): SecretKey {
        val keyGen = KeyGenerator.getInstance("AES")
        keyGen.init(256, secureRandom)
        return keyGen.generateKey()
    }

    fun wrapDEK(dekKey: SecretKey, kekKey: SecretKey): Pair<String, String> {
        val ivStr = generateIv()
        val ivBytes = Base64.decode(ivStr, Base64.NO_WRAP)

        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val spec = GCMParameterSpec(128, ivBytes)
        cipher.init(Cipher.ENCRYPT_MODE, kekKey, spec)

        val encryptedBytes = cipher.doFinal(dekKey.encoded)
        val encryptedBase64 = Base64.encodeToString(encryptedBytes, Base64.NO_WRAP)

        return Pair(encryptedBase64, ivStr)
    }

    fun unwrapDEK(encryptedDekBase64: String, ivBase64: String, kekKey: SecretKey): SecretKey {
        val encryptedBytes = Base64.decode(encryptedDekBase64, Base64.NO_WRAP)
        val ivBytes = Base64.decode(ivBase64, Base64.NO_WRAP)

        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val spec = GCMParameterSpec(128, ivBytes)
        cipher.init(Cipher.DECRYPT_MODE, kekKey, spec)

        val dekBytes = cipher.doFinal(encryptedBytes)
        val dek = SecretKeySpec(dekBytes, "AES")
        dekBytes.fill(0)
        return dek
    }

    fun encryptText(plaintext: String, dekKey: SecretKey): Pair<String, String> {
        val ivStr = generateIv()
        val ivBytes = Base64.decode(ivStr, Base64.NO_WRAP)

        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val spec = GCMParameterSpec(128, ivBytes)
        cipher.init(Cipher.ENCRYPT_MODE, dekKey, spec)

        val encryptedBytes = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))
        val ciphertextBase64 = Base64.encodeToString(encryptedBytes, Base64.NO_WRAP)

        return Pair(ciphertextBase64, ivStr)
    }

    fun decryptText(ciphertextBase64: String, ivBase64: String, dekKey: SecretKey): String {
        val ciphertextBytes = Base64.decode(ciphertextBase64, Base64.NO_WRAP)
        val ivBytes = Base64.decode(ivBase64, Base64.NO_WRAP)

        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val spec = GCMParameterSpec(128, ivBytes)
        cipher.init(Cipher.DECRYPT_MODE, dekKey, spec)

        val decryptedBytes = cipher.doFinal(ciphertextBytes)
        return String(decryptedBytes, Charsets.UTF_8)
    }

    fun encryptBytes(data: ByteArray, dekKey: SecretKey): Pair<ByteArray, ByteArray> {
        val ivBytes = generateRawIv()
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val spec = GCMParameterSpec(128, ivBytes)
        cipher.init(Cipher.ENCRYPT_MODE, dekKey, spec)

        val encryptedBytes = cipher.doFinal(data)
        return Pair(encryptedBytes, ivBytes)
    }

    fun decryptBytes(encryptedData: ByteArray, ivBytes: ByteArray, dekKey: SecretKey): ByteArray {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val spec = GCMParameterSpec(128, ivBytes)
        cipher.init(Cipher.DECRYPT_MODE, dekKey, spec)
        return cipher.doFinal(encryptedData)
    }

    fun verifyDEK(dekKey: SecretKey, verificationPayloadBase64: String, verificationIvBase64: String): Boolean {
        return try {
            val result = decryptText(verificationPayloadBase64, verificationIvBase64, dekKey)
            result == "VERIFIED_JOURNAL_KEY"
        } catch (e: Exception) {
            false
        }
    }
}
