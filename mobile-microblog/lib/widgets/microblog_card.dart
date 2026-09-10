import 'package:flutter/cupertino.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:intl/intl.dart';
import '../core/models/microblog_post.dart';
import '../core/theme/cupertino_theme.dart';
import 'image_gallery_view.dart';
import 'post_action_sheet.dart';

class MicroblogCard extends StatelessWidget {
  final MicroblogPost post;
  final VoidCallback onEdit;
  final VoidCallback onToggleStatus;
  final VoidCallback onDelete;

  const MicroblogCard({
    super.key,
    required this.post,
    required this.onEdit,
    required this.onToggleStatus,
    required this.onDelete,
  });

  String _formatRelativeTime(DateTime dateTime) {
    final now = DateTime.now();
    final difference = now.difference(dateTime);

    if (difference.inSeconds < 60) {
      return 'Just now';
    } else if (difference.inMinutes < 60) {
      return '${difference.inMinutes}m ago';
    } else if (difference.inHours < 24) {
      return '${difference.inHours}h ago';
    } else if (difference.inDays == 1) {
      return 'Yesterday';
    } else if (difference.inDays < 7) {
      return '${difference.inDays}d ago';
    } else {
      return DateFormat('MMM d, yyyy').format(dateTime);
    }
  }

  @override
  Widget build(BuildContext context) {
    final allImages = <String>[];
    if (post.coverImageUrl != null && post.coverImageUrl!.isNotEmpty) {
      allImages.add(post.coverImageUrl!);
    }
    for (final img in post.images) {
      if (img.isNotEmpty && !allImages.contains(img)) {
        allImages.add(img);
      }
    }

    final isPublished = post.isPublished;
    final timeStr = _formatRelativeTime(post.publishedAt ?? post.createdAt);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: AppCupertinoTheme.cardBackground.resolveFrom(context),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppCupertinoTheme.cardBorder.resolveFrom(context),
          width: 0.8,
        ),
        boxShadow: [
          BoxShadow(
            color: CupertinoColors.systemGrey5.resolveFrom(context).withValues(alpha: 0.4),
            offset: const Offset(0, 2),
            blurRadius: 8,
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Row: Time, Status Badge & Action Menu
            Row(
              children: [
                // Status Pill
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: isPublished
                        ? CupertinoColors.systemGreen.withValues(alpha: 0.15)
                        : CupertinoColors.systemOrange.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: isPublished
                              ? CupertinoColors.systemGreen
                              : CupertinoColors.systemOrange,
                        ),
                      ),
                      const SizedBox(width: 5),
                      Text(
                        isPublished ? 'Published' : 'Draft',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: isPublished
                              ? CupertinoColors.systemGreen.resolveFrom(context)
                              : CupertinoColors.systemOrange.resolveFrom(context),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),

                // Relative Time
                Text(
                  timeStr,
                  style: TextStyle(
                    fontSize: 13,
                    color: CupertinoColors.secondaryLabel.resolveFrom(context),
                  ),
                ),

                const Spacer(),

                // Actions Ellipsis Button
                CupertinoButton(
                  padding: EdgeInsets.zero,
                  minimumSize: const Size(28, 28),
                  onPressed: () {
                    PostActionSheet.show(
                      context: context,
                      post: post,
                      onEdit: onEdit,
                      onToggleStatus: onToggleStatus,
                      onDelete: onDelete,
                    );
                  },
                  child: Icon(
                    CupertinoIcons.ellipsis,
                    size: 20,
                    color: CupertinoColors.secondaryLabel.resolveFrom(context),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 10),

            // Content Markdown
            if (post.contentMarkdown.isNotEmpty)
              MarkdownBody(
                data: post.contentMarkdown,
                selectable: false,
                styleSheet: MarkdownStyleSheet(
                  p: TextStyle(
                    fontSize: 15.5,
                    height: 1.45,
                    letterSpacing: -0.2,
                    color: CupertinoColors.label.resolveFrom(context),
                  ),
                  strong: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: CupertinoColors.label.resolveFrom(context),
                  ),
                  a: const TextStyle(
                    color: CupertinoColors.systemBlue,
                    decoration: TextDecoration.underline,
                  ),
                  code: TextStyle(
                    backgroundColor:
                        AppCupertinoTheme.subtleFill.resolveFrom(context),
                    fontFamily: 'monospace',
                    fontSize: 14,
                  ),
                ),
              ),

            // Images Grid / Thumbnail Preview
            if (allImages.isNotEmpty) ...[
              const SizedBox(height: 12),
              _buildImagesPreview(context, allImages),
            ],

            // Tags & Meta Row
            if (post.tags.isNotEmpty) ...[
              const SizedBox(height: 12),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: post.tags.map((tag) {
                  return Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppCupertinoTheme.subtleFill.resolveFrom(context),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '#$tag',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color:
                            CupertinoColors.secondaryLabel.resolveFrom(context),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildImagesPreview(BuildContext context, List<String> images) {
    if (images.length == 1) {
      return GestureDetector(
        onTap: () => ImageGalleryView.show(context, images, initialIndex: 0),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: AspectRatio(
            aspectRatio: 16 / 9,
            child: CachedNetworkImage(
              imageUrl: images[0],
              fit: BoxFit.cover,
              placeholder: (ctx, url) => Container(
                color: AppCupertinoTheme.subtleFill.resolveFrom(context),
                child: const Center(child: CupertinoActivityIndicator()),
              ),
              errorWidget: (ctx, url, err) => Container(
                color: AppCupertinoTheme.subtleFill.resolveFrom(context),
                child: const Icon(CupertinoIcons.photo, size: 36),
              ),
            ),
          ),
        ),
      );
    }

    // Multiple Images (up to 4 thumbnails in grid)
    final displayCount = images.length > 4 ? 4 : images.length;
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: displayCount,
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 6,
          mainAxisSpacing: 6,
          childAspectRatio: 1.4,
        ),
        itemBuilder: (ctx, index) {
          final isLast = index == 3 && images.length > 4;
          final remaining = images.length - 4;

          return GestureDetector(
            onTap: () => ImageGalleryView.show(context, images, initialIndex: index),
            child: Stack(
              fit: StackFit.expand,
              children: [
                CachedNetworkImage(
                  imageUrl: images[index],
                  fit: BoxFit.cover,
                  placeholder: (c, url) => Container(
                    color: AppCupertinoTheme.subtleFill.resolveFrom(context),
                    child: const Center(child: CupertinoActivityIndicator()),
                  ),
                  errorWidget: (c, url, err) => Container(
                    color: AppCupertinoTheme.subtleFill.resolveFrom(context),
                    child: const Icon(CupertinoIcons.photo),
                  ),
                ),
                if (isLast)
                  Container(
                    color: CupertinoColors.black.withValues(alpha: 0.55),
                    child: Center(
                      child: Text(
                        '+$remaining',
                        style: const TextStyle(
                          color: CupertinoColors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}
