package com.personal.cms.journal.ui.auth

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Key
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.personal.cms.journal.data.crypto.KeystoreManager
import com.personal.cms.journal.data.repository.AuthRepository
import com.personal.cms.journal.data.repository.AuthResult
import kotlinx.coroutines.launch

@Composable
fun LoginScreen(
    authRepository: AuthRepository,
    keystoreManager: KeystoreManager,
    onLoginSuccess: () -> Unit,
    onChangeInstance: () -> Unit
) {
    var cmsPassword by remember { mutableStateOf("") }
    var journalPassword by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var step by remember { mutableStateOf(if (keystoreManager.getAuthToken() != null) 2 else 1) }

    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            Icons.Default.Lock,
            contentDescription = "Lock",
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(56.dp)
        )
        Spacer(modifier = Modifier.height(12.dp))

        Text(
            text = if (step == 1) "CMS Authentication" else "Unlock Encrypted Journal",
            style = MaterialTheme.typography.headlineMedium
        )
        Spacer(modifier = Modifier.height(4.dp))

        Text(
            text = if (step == 1) "Enter your CMS master password to sign in." else "Enter your Journal Encryption Password to derive DEK key.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(24.dp))

        if (step == 1) {
            OutlinedTextField(
                value = cmsPassword,
                onValueChange = { cmsPassword = it; errorMessage = null },
                label = { Text("CMS Password") },
                visualTransformation = PasswordVisualTransformation(),
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
        } else {
            OutlinedTextField(
                value = journalPassword,
                onValueChange = { journalPassword = it; errorMessage = null },
                label = { Text("Journal Encryption Password") },
                visualTransformation = PasswordVisualTransformation(),
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        if (errorMessage != null) {
            Text(
                text = errorMessage!!,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall
            )
            Spacer(modifier = Modifier.height(12.dp))
        }

        Button(
            onClick = {
                scope.launch {
                    isLoading = true
                    errorMessage = null

                    if (step == 1) {
                        val result = authRepository.login(cmsPassword)
                        isLoading = false
                        if (result is AuthResult.Success) {
                            step = 2
                        } else if (result is AuthResult.Error) {
                            errorMessage = result.message
                        }
                    } else {
                        val unlockRes = authRepository.unlockJournalWithPassword(journalPassword)
                        isLoading = false
                        if (unlockRes is AuthResult.Success) {
                            onLoginSuccess()
                        } else if (unlockRes is AuthResult.Error) {
                            errorMessage = unlockRes.message
                        }
                    }
                }
            },
            enabled = !isLoading && ((step == 1 && cmsPassword.isNotBlank()) || (step == 2 && journalPassword.isNotBlank())),
            modifier = Modifier.fillMaxWidth()
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = MaterialTheme.colorScheme.onPrimary,
                    strokeWidth = 2.dp
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(if (step == 1) "Authenticating..." else "Deriving Argon2 KEK...")
            } else {
                Text(if (step == 1) "Sign In" else "Unlock Journal")
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        TextButton(onClick = onChangeInstance) {
            Text("Change Instance URL (${keystoreManager.getBaseUrl() ?: ""})")
        }
    }
}
