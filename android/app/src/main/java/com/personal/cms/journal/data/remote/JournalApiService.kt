package com.personal.cms.journal.data.remote

import com.personal.cms.journal.data.remote.dto.EntriesResponse
import com.personal.cms.journal.data.remote.dto.EntryDto
import com.personal.cms.journal.data.remote.dto.KeyRecordDto
import com.personal.cms.journal.data.remote.dto.KeysResponse
import com.personal.cms.journal.data.remote.dto.LoginRequest
import com.personal.cms.journal.data.remote.dto.LoginResponse
import com.personal.cms.journal.data.remote.dto.SettingsRecordDto
import com.personal.cms.journal.data.remote.dto.SettingsResponse
import com.personal.cms.journal.data.remote.dto.SingleEntryResponse
import com.personal.cms.journal.data.remote.dto.StatusResponse
import com.personal.cms.journal.data.remote.dto.SyncRequest
import com.personal.cms.journal.data.remote.dto.SyncResponse
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.logging.LogLevel
import io.ktor.client.plugins.logging.Logging
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json

class JournalApiService {

    private val client = HttpClient(OkHttp) {
        install(ContentNegotiation) {
            json(Json {
                ignoreUnknownKeys = true
                isLenient = true
                encodeDefaults = true
            })
        }
        install(Logging) {
            level = LogLevel.HEADERS
        }
    }

    suspend fun checkStatus(baseUrl: String): StatusResponse {
        val url = "$baseUrl/api/journal/status"
        return client.get(url).body()
    }

    suspend fun login(baseUrl: String, password: String): LoginResponse {
        val url = "$baseUrl/api/auth/login"
        return client.post(url) {
            contentType(ContentType.Application.Json)
            setBody(LoginRequest(password))
        }.body()
    }

    suspend fun getKeys(baseUrl: String, token: String): KeysResponse {
        val url = "$baseUrl/api/journal/keys"
        return client.get(url) {
            header("Authorization", "Bearer $token")
        }.body()
    }

    suspend fun saveKeys(baseUrl: String, token: String, keyRecord: KeyRecordDto): KeysResponse {
        val url = "$baseUrl/api/journal/keys"
        return client.post(url) {
            header("Authorization", "Bearer $token")
            contentType(ContentType.Application.Json)
            setBody(keyRecord)
        }.body()
    }

    suspend fun getSettings(baseUrl: String, token: String): SettingsResponse {
        val url = "$baseUrl/api/journal/settings"
        return client.get(url) {
            header("Authorization", "Bearer $token")
        }.body()
    }

    suspend fun saveSettings(baseUrl: String, token: String, settingsRecord: SettingsRecordDto): SettingsResponse {
        val url = "$baseUrl/api/journal/settings"
        return client.post(url) {
            header("Authorization", "Bearer $token")
            contentType(ContentType.Application.Json)
            setBody(settingsRecord)
        }.body()
    }

    suspend fun fetchEntries(baseUrl: String, token: String, since: String? = null): EntriesResponse {
        val url = if (since != null) "$baseUrl/api/journal/entries?since=$since" else "$baseUrl/api/journal/entries"
        return client.get(url) {
            header("Authorization", "Bearer $token")
        }.body()
    }

    suspend fun createEntry(baseUrl: String, token: String, entry: EntryDto): SingleEntryResponse {
        val url = "$baseUrl/api/journal/entries"
        return client.post(url) {
            header("Authorization", "Bearer $token")
            contentType(ContentType.Application.Json)
            setBody(entry)
        }.body()
    }

    suspend fun updateEntry(baseUrl: String, token: String, id: String, entry: EntryDto): SingleEntryResponse {
        val url = "$baseUrl/api/journal/entries/$id"
        return client.put(url) {
            header("Authorization", "Bearer $token")
            contentType(ContentType.Application.Json)
            setBody(entry)
        }.body()
    }

    suspend fun deleteEntry(baseUrl: String, token: String, id: String) {
        val url = "$baseUrl/api/journal/entries/$id"
        client.delete(url) {
            header("Authorization", "Bearer $token")
        }
    }

    suspend fun batchSync(baseUrl: String, token: String, syncRequest: SyncRequest): SyncResponse {
        val url = "$baseUrl/api/journal/sync"
        return client.post(url) {
            header("Authorization", "Bearer $token")
            contentType(ContentType.Application.Json)
            setBody(syncRequest)
        }.body()
    }
}
