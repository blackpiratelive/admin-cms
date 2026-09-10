import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import '../core/models/microblog_post.dart';

class PostActionSheet {
  static void show({
    required BuildContext context,
    required MicroblogPost post,
    required VoidCallback onEdit,
    required VoidCallback onToggleStatus,
    required VoidCallback onDelete,
  }) {
    HapticFeedback.lightImpact();

    showCupertinoModalPopup<void>(
      context: context,
      builder: (BuildContext ctx) => CupertinoActionSheet(
        title: Text(
          post.slug.isNotEmpty ? post.slug : 'Microblog Actions',
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        message: Text(
          post.isPublished ? 'Status: Published' : 'Status: Draft',
        ),
        actions: <CupertinoActionSheetAction>[
          CupertinoActionSheetAction(
            onPressed: () {
              Navigator.of(ctx).pop();
              onEdit();
            },
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(CupertinoIcons.pencil, size: 20),
                SizedBox(width: 8),
                Text('Edit Post'),
              ],
            ),
          ),
          CupertinoActionSheetAction(
            onPressed: () {
              Navigator.of(ctx).pop();
              onToggleStatus();
            },
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  post.isPublished
                      ? CupertinoIcons.arrow_uturn_down_circle
                      : CupertinoIcons.arrow_up_circle,
                  size: 20,
                ),
                SizedBox(width: 8),
                Text(post.isPublished ? 'Change to Draft' : 'Publish Immediately'),
              ],
            ),
          ),
          if (post.shortUrl != null && post.shortUrl!.isNotEmpty)
            CupertinoActionSheetAction(
              onPressed: () {
                Navigator.of(ctx).pop();
                Clipboard.setData(ClipboardData(text: post.shortUrl!));
                HapticFeedback.mediumImpact();
              },
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(CupertinoIcons.link, size: 20),
                  SizedBox(width: 8),
                  Text('Copy Short URL'),
                ],
              ),
            ),
          CupertinoActionSheetAction(
            isDestructiveAction: true,
            onPressed: () {
              Navigator.of(ctx).pop();
              _confirmDelete(context, post, onDelete);
            },
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(CupertinoIcons.trash, color: CupertinoColors.destructiveRed, size: 20),
                SizedBox(width: 8),
                Text('Delete Post'),
              ],
            ),
          ),
        ],
        cancelButton: CupertinoActionSheetAction(
          isDefaultAction: true,
          onPressed: () => Navigator.of(ctx).pop(),
          child: const Text('Cancel'),
        ),
      ),
    );
  }

  static void _confirmDelete(
    BuildContext context,
    MicroblogPost post,
    VoidCallback onDelete,
  ) {
    showCupertinoDialog<void>(
      context: context,
      builder: (BuildContext ctx) => CupertinoAlertDialog(
        title: const Text('Delete Post?'),
        content: const Text(
          'Are you sure you want to permanently delete this microblog post? This action cannot be undone.',
        ),
        actions: <CupertinoDialogAction>[
          CupertinoDialogAction(
            isDefaultAction: true,
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          CupertinoDialogAction(
            isDestructiveAction: true,
            onPressed: () {
              Navigator.of(ctx).pop();
              onDelete();
            },
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }
}
