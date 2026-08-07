import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/network/api_client.dart';
import 'toast_notification.dart';

class DeployWidget extends StatefulWidget {
  const DeployWidget({super.key});

  @override
  State<DeployWidget> createState() => _DeployWidgetState();
}

class _DeployWidgetState extends State<DeployWidget> {
  bool _isDeploying = false;

  Future<void> _handleDeploy() async {
    setState(() => _isDeploying = true);
    try {
      final success = await ApiClient.triggerDeploy();
      if (mounted) {
        ToastNotification.show(
          context,
          title: success ? 'Deployment Triggered' : 'Deployment Trigger Failed',
          message: success
              ? 'Vercel deploy hook sent successfully.'
              : 'Could not connect to deployment hook endpoint.',
          isError: !success,
        );
      }
    } catch (e) {
      if (mounted) {
        ToastNotification.show(
          context,
          title: 'Deploy Error',
          message: e.toString(),
          isError: true,
        );
      }
    } finally {
      if (mounted) setState(() => _isDeploying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: colorScheme.outline.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Icon(LucideIcons.rocket, size: 14, color: colorScheme.primary),
              const SizedBox(width: 6),
              Text(
                'Vercel Deployment',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                  color: colorScheme.onSurface,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Ready to deploy',
            style: TextStyle(
              fontSize: 11,
              color: colorScheme.onSurface.withValues(alpha: 0.6),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _isDeploying ? null : _handleDeploy,
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
                side: BorderSide(color: colorScheme.outline.withValues(alpha: 0.3)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
              ),
              icon: _isDeploying
                  ? const SizedBox(
                      width: 12,
                      height: 12,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Icon(LucideIcons.refreshCw, size: 13, color: colorScheme.onSurface),
              label: Text(
                _isDeploying ? 'Triggering...' : 'Trigger Redeploy',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: colorScheme.onSurface,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
