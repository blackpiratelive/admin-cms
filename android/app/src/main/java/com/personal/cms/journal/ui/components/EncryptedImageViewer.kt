package com.personal.cms.journal.ui.components

import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.rememberTransformableState
import androidx.compose.foundation.gestures.transformable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.personal.cms.journal.data.crypto.CryptoEngine
import com.personal.cms.journal.data.crypto.KeystoreManager
import java.io.File

@Composable
fun EncryptedImageViewer(
    assetId: String,
    onClose: () -> Unit
) {
    val context = LocalContext.current
    val keystoreManager = remember { KeystoreManager(context) }
    var scale by remember { mutableStateOf(1f) }
    var offset by remember { mutableStateOf(androidx.compose.ui.geometry.Offset.Zero) }

    val dek = keystoreManager.activeDEK

    val bitmap = remember(assetId, dek) {
        if (dek == null) return@remember null
        val dir = File(context.filesDir, "encrypted_assets")
        val origFile = File(dir, "${assetId}_orig.enc")
        val thumbFile = File(dir, "${assetId}_thumb.enc")
        val targetFile = if (origFile.exists()) origFile else if (thumbFile.exists()) thumbFile else null
        if (targetFile == null) return@remember null

        try {
            val rawEncrypted = targetFile.readBytes()
            // First 12 bytes = IV, rest = ciphertext
            val iv = rawEncrypted.copyOfRange(0, 12)
            val ciphertext = rawEncrypted.copyOfRange(12, rawEncrypted.size)
            val decrypted = CryptoEngine.decryptBytes(ciphertext, iv, dek)
            BitmapFactory.decodeByteArray(decrypted, 0, decrypted.size)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    val state = rememberTransformableState { zoomChange, offsetChange, _ ->
        scale = (scale * zoomChange).coerceIn(1f, 5f)
        offset += offsetChange
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        if (bitmap != null) {
            Image(
                bitmap = bitmap.asImageBitmap(),
                contentDescription = "Encrypted Photo",
                modifier = Modifier
                    .fillMaxSize()
                    .graphicsLayer(
                        scaleX = scale,
                        scaleY = scale,
                        translationX = offset.x,
                        translationY = offset.y
                    )
                    .transformable(state = state)
            )
        } else {
            Column(
                modifier = Modifier.align(Alignment.Center),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Icon(Icons.Default.Lock, contentDescription = null, tint = Color.Red, modifier = Modifier.size(48.dp))
                Spacer(modifier = Modifier.height(8.dp))
                Text("Decryption failed or asset not found", color = Color.White)
            }
        }

        // Close Button
        IconButton(
            onClick = onClose,
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(16.dp)
        ) {
            Icon(Icons.Default.Close, contentDescription = "Close", tint = Color.White)
        }
    }
}
