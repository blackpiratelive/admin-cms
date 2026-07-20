package com.personal.cms.journal.ui.onboarding

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.personal.cms.journal.data.crypto.KeystoreManager
import com.personal.cms.journal.data.repository.AuthRepository
import kotlinx.coroutines.launch

@Composable
fun OnboardingScreen(
    authRepository: AuthRepository,
    keystoreManager: KeystoreManager,
    onOnboardingComplete: () -> Unit
) {
    var urlText by remember { mutableStateOf(keystoreManager.getBaseUrl() ?: "https://") }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            Icons.Default.Cloud,
            contentDescription = "CMS Cloud",
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(64.dp)
        )
        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "Connect to Personal CMS",
            style = MaterialTheme.typography.headlineMedium
        )
        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Enter your self-hosted CMS base URL to enable encrypted offline journal synchronization.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(24.dp))

        OutlinedTextField(
            value = urlText,
            onValueChange = {
                urlText = it
                errorMessage = null
            },
            label = { Text("CMS Base URL") },
            placeholder = { Text("https://cms.example.com") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(16.dp))

        if (errorMessage != null) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.Warning, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = errorMessage!!,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall
                )
            }
            Spacer(modifier = Modifier.height(16.dp))
        }

        Button(
            onClick = {
                scope.launch {
                    val trimmed = urlText.trim().trimEnd('/')
                    if (!trimmed.startsWith("https://") && !trimmed.startsWith("http://")) {
                        errorMessage = "URL must start with https://"
                        return@launch
                    }

                    isLoading = true
                    errorMessage = null

                    val isValid = authRepository.validateInstance(trimmed)
                    isLoading = false

                    if (isValid) {
                        keystoreManager.setBaseUrl(trimmed)
                        onOnboardingComplete()
                    } else {
                        errorMessage = "Cannot reach CMS or invalid API compatibility"
                    }
                }
            },
            enabled = !isLoading && urlText.isNotBlank(),
            modifier = Modifier.fillMaxWidth()
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = MaterialTheme.colorScheme.onPrimary,
                    strokeWidth = 2.dp
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text("Testing Connection...")
            } else {
                Text("Connect & Continue")
            }
        }
    }
}
