import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:typed_data';
import '../../../core/crypto/journal_crypto.dart';
import '../../../core/crypto/journal_session_vault.dart';
import '../../../core/models/journal_asset.dart';
import '../../../core/network/api_client.dart';
import '../../../shared/widgets/toast_notification.dart';

class JournalAttachmentsWidget extends StatefulWidget {
  final String? entryId;

  const JournalAttachmentsWidget({super.key, this.entryId});

  @override
  State<JournalAttachmentsWidget> createState() => _JournalAttachmentsWidgetState();
}

class _JournalAttachmentsWidgetState extends State<JournalAttachmentsWidget> {
  List<JournalAssetRecord> _assets = [];
  final Map<String, Uint8List> _decryptedThumbnails = {};
  bool _isLoading = false;
  bool _isUploading = false;

  @override
  void initState() {
    super.initState();
    _loadAssets();
  }

  @override
  void didUpdateWidget(covariant JournalAttachmentsWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.entryId != oldWidget.entryId) {
      _loadAssets();
    }
  }

  Future<void> _loadAssets() async {
    if (widget.entryId == null) return;
    setState(() => _isLoading = true);

    try {
      final records = await ApiClient.getJournalAssets(widget.entryId!);
      setState(() {
        _assets = records;
        _isLoading = false;
      });

      _decryptThumbnails();
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _decryptThumbnails() async {
    final dek = JournalSessionVault.activeDek;
    if (dek == null) return;

    for (final asset in _assets) {
      if (_decryptedThumbnails.containsKey(asset.id)) continue;

      try {
        final publicId = asset.cloudinaryThumbnailPublicId.isNotEmpty
            ? asset.cloudinaryThumbnailPublicId
            : asset.cloudinaryOriginalPublicId;
        final iv = asset.thumbnailIv.isNotEmpty ? asset.thumbnailIv : asset.originalIv;

        if (publicId.isNotEmpty && iv.isNotEmpty) {
          final encBytes = await ApiClient.downloadRawEncryptedAsset(publicId);
          final decBytes = await JournalCryptoEngine.decryptBytes(encBytes, iv, dek);

          if (mounted) {
            setState(() {
              _decryptedThumbnails[asset.id] = Uint8List.fromList(decBytes);
            });
          }
        }
      } catch (_) {}
    }
  }

  Future<void> _pickAndUploadAttachment() async {
    final dek = JournalSessionVault.activeDek;
    if (dek == null) {
      ToastNotification.show(context, title: 'Vault Locked', message: 'Please unlock vault first.', isError: true);
      return;
    }

    try {
      final picker = ImagePicker();
      final file = await picker.pickImage(source: ImageSource.gallery, imageQuality: 90);
      if (file == null) return;

      setState(() => _isUploading = true);

      final rawBytes = await file.readAsBytes();

      // Encrypt file bytes with DEK
      final encryptedData = await JournalCryptoEngine.encryptBytes(rawBytes, dek);

      // Upload raw encrypted binary file to Cloudinary
      final assetName = 'jasset_${DateTime.now().millisecondsSinceEpoch}_${file.name}.enc';
      final uploadRes = await ApiClient.uploadRawEncryptedAsset(encryptedData['encryptedBytes'], assetName);

      // Save database record
      final assetRecord = await ApiClient.createJournalAssetRecord({
        'assetType': 'image',
        'mimeType': file.mimeType ?? 'image/jpeg',
        'width': 1200,
        'height': 900,
        'originalSize': rawBytes.length,
        'compressedSize': rawBytes.length,
        'thumbnailSize': rawBytes.length,
        'cloudinaryOriginalPublicId': uploadRes['public_id'],
        'cloudinaryThumbnailPublicId': uploadRes['public_id'],
        'originalIv': encryptedData['iv'],
        'thumbnailIv': encryptedData['iv'],
        'encryptionVersion': 1,
        'entryId': widget.entryId,
        'assetRole': 'attachment',
      });

      setState(() {
        _assets.add(assetRecord);
        _decryptedThumbnails[assetRecord.id] = Uint8List.fromList(rawBytes);
        _isUploading = false;
      });

      if (mounted) {
        ToastNotification.show(context, title: 'Attachment Encrypted', message: 'E2EE image attached to journal entry.');
      }
    } catch (e) {
      setState(() => _isUploading = false);
      if (mounted) {
        ToastNotification.show(context, title: 'Upload Failed', message: e.toString(), isError: true);
      }
    }
  }

  Future<void> _handleDelete(JournalAssetRecord asset) async {
    try {
      await ApiClient.deleteJournalAssetRecord(asset.id);
      setState(() {
        _assets.removeWhere((a) => a.id == asset.id);
        _decryptedThumbnails.remove(asset.id);
      });
      if (mounted) {
        ToastNotification.show(context, title: 'Deleted', message: 'Attachment removed.');
      }
    } catch (e) {
      if (mounted) {
        ToastNotification.show(context, title: 'Delete Failed', message: e.toString(), isError: true);
      }
    }
  }

  void _showImageLightbox(Uint8List bytes) {
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        child: Stack(
          alignment: Alignment.center,
          children: [
            InteractiveViewer(
              child: Image.memory(bytes),
            ),
            Positioned(
              top: 10,
              right: 10,
              child: IconButton(
                icon: const Icon(Icons.close, color: Colors.white, size: 28),
                onPressed: () => Navigator.of(ctx).pop(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colorScheme.outline.withValues(alpha: 0.2)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Bar matching Web UI
          Row(
            children: [
              Icon(LucideIcons.paperclip, size: 16, color: colorScheme.primary),
              const SizedBox(width: 8),
              Text(
                'Encrypted Entry Attachments (${_assets.length})',
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.amber.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.amber.withValues(alpha: 0.3)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: const [
                    Icon(LucideIcons.lock, size: 11, color: Colors.amber),
                    SizedBox(width: 4),
                    Text(
                      'E2EE Blobs',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.amber),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              ElevatedButton.icon(
                onPressed: _isUploading ? null : _pickAndUploadAttachment,
                style: ElevatedButton.styleFrom(
                  backgroundColor: colorScheme.primary,
                  foregroundColor: Colors.white,
                  elevation: 1,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                ),
                icon: _isUploading
                    ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(LucideIcons.cloudUpload, size: 14),
                label: const Text('Add Attachment', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Content Box
          if (_isLoading)
            const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator()))
          else if (_assets.isEmpty)
            InkWell(
              onTap: _pickAndUploadAttachment,
              borderRadius: BorderRadius.circular(8),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 16),
                decoration: BoxDecoration(
                  color: colorScheme.onSurface.withValues(alpha: 0.02),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: colorScheme.outline.withValues(alpha: 0.15), style: BorderStyle.solid),
                ),
                child: Column(
                  children: [
                    Icon(LucideIcons.fileImage, size: 36, color: colorScheme.onSurface.withValues(alpha: 0.4)),
                    const SizedBox(height: 10),
                    const Text('No attachments added to this entry yet', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                    const SizedBox(height: 4),
                    Text(
                      'Click here to upload end-to-end encrypted attachments.',
                      style: TextStyle(fontSize: 11, color: colorScheme.onSurface.withValues(alpha: 0.5)),
                    ),
                  ],
                ),
              ),
            )
          else
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                maxCrossAxisExtent: 150,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
                childAspectRatio: 1,
              ),
              itemCount: _assets.length,
              itemBuilder: (context, index) {
                final asset = _assets[index];
                final decBytes = _decryptedThumbnails[asset.id];

                return Stack(
                  children: [
                    Positioned.fill(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(6),
                        child: decBytes != null
                            ? InkWell(
                                onTap: () => _showImageLightbox(decBytes),
                                child: Image.memory(decBytes, fit: BoxFit.cover),
                              )
                            : Container(
                                color: colorScheme.onSurface.withValues(alpha: 0.05),
                                child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
                              ),
                      ),
                    ),
                    Positioned(
                      top: 4,
                      right: 4,
                      child: InkWell(
                        onTap: () => _handleDelete(asset),
                        child: Container(
                          padding: const EdgeInsets.all(4),
                          decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle),
                          child: const Icon(LucideIcons.trash2, size: 12, color: Colors.white),
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
        ],
      ),
    );
  }
}
