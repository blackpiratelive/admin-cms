class JournalAssetRecord {
  final String id;
  final String assetType;
  final String mimeType;
  final int width;
  final int height;
  final int originalSize;
  final int compressedSize;
  final int thumbnailSize;
  final String cloudinaryOriginalPublicId;
  final String cloudinaryThumbnailPublicId;
  final String originalIv;
  final String thumbnailIv;
  final int encryptionVersion;
  final String createdAt;
  final String updatedAt;
  final String? assetRole;
  final int? position;

  JournalAssetRecord({
    required this.id,
    required this.assetType,
    required this.mimeType,
    required this.width,
    required this.height,
    required this.originalSize,
    required this.compressedSize,
    required this.thumbnailSize,
    required this.cloudinaryOriginalPublicId,
    required this.cloudinaryThumbnailPublicId,
    required this.originalIv,
    required this.thumbnailIv,
    required this.encryptionVersion,
    required this.createdAt,
    required this.updatedAt,
    this.assetRole,
    this.position,
  });

  factory JournalAssetRecord.fromJson(Map<String, dynamic> json) {
    return JournalAssetRecord(
      id: json['id'] as String? ?? '',
      assetType: json['assetType'] as String? ?? json['asset_type'] as String? ?? 'image',
      mimeType: json['mimeType'] as String? ?? json['mime_type'] as String? ?? 'image/jpeg',
      width: json['width'] as int? ?? 800,
      height: json['height'] as int? ?? 600,
      originalSize: json['originalSize'] as int? ?? json['original_size'] as int? ?? 0,
      compressedSize: json['compressedSize'] as int? ?? json['compressed_size'] as int? ?? 0,
      thumbnailSize: json['thumbnailSize'] as int? ?? json['thumbnail_size'] as int? ?? 0,
      cloudinaryOriginalPublicId: json['cloudinaryOriginalPublicId'] as String? ?? json['cloudinary_original_public_id'] as String? ?? '',
      cloudinaryThumbnailPublicId: json['cloudinaryThumbnailPublicId'] as String? ?? json['cloudinary_thumbnail_public_id'] as String? ?? '',
      originalIv: json['originalIv'] as String? ?? json['original_iv'] as String? ?? '',
      thumbnailIv: json['thumbnailIv'] as String? ?? json['thumbnail_iv'] as String? ?? '',
      encryptionVersion: json['encryptionVersion'] as int? ?? json['encryption_version'] as int? ?? 1,
      createdAt: json['createdAt'] as String? ?? json['created_at'] as String? ?? '',
      updatedAt: json['updatedAt'] as String? ?? json['updated_at'] as String? ?? '',
      assetRole: json['assetRole'] as String? ?? json['asset_role'] as String?,
      position: json['position'] as int?,
    );
  }
}
