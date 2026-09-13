import 'package:uuid/uuid.dart';
import '../storage/local_store.dart';
import '../models/offline_mutation.dart';
import 'api_service.dart';

class SyncService {
  static const _uuid = Uuid();
  static bool _isSyncing = false;

  /// Enqueue an offline mutation and attempt background sync if online
  static Future<void> queueMutation({
    required String type,
    required String entityId,
    required Map<String, dynamic> payload,
  }) async {
    final mutation = OfflineMutation(
      id: _uuid.v4(),
      type: type,
      entityId: entityId,
      payload: payload,
      timestamp: DateTime.now().toIso8601String(),
    );

    await LocalStore.enqueueMutation(mutation);
    // Fire background sync attempt
    processQueue();
  }

  /// Process all queued offline mutations sequentially
  static Future<int> processQueue() async {
    if (_isSyncing) return 0;
    _isSyncing = true;

    int processed = 0;
    try {
      final queue = await LocalStore.getOfflineQueue();
      if (queue.isEmpty) {
        _isSyncing = false;
        return 0;
      }

      for (final mutation in queue) {
        bool success = false;
        try {
          switch (mutation.type) {
            case 'create_person':
              await ApiService.savePerson(mutation.payload);
              success = true;
              break;
            case 'update_person':
              await ApiService.updatePerson(mutation.entityId, mutation.payload);
              success = true;
              break;
            case 'delete_person':
              await ApiService.deletePerson(mutation.entityId);
              success = true;
              break;
            case 'toggle_favorite':
              await ApiService.toggleFavorite(mutation.entityId);
              success = true;
              break;
            case 'add_connection':
              await ApiService.addConnection(
                personId: mutation.entityId,
                targetType: mutation.payload['targetType'] as String? ?? 'location',
                targetId: mutation.payload['targetId'] as String? ?? '',
                relationship: mutation.payload['relationship'] as String? ?? 'connected_to',
              );
              success = true;
              break;
            case 'remove_connection':
              await ApiService.removeConnection(
                personId: mutation.entityId,
                relationshipId: mutation.payload['relationshipId'] as String? ?? '',
              );
              success = true;
              break;
          }
        } catch (e) {
          // If network error, stop processing and keep remaining queue
          break;
        }

        if (success) {
          await LocalStore.removeMutation(mutation.id);
          processed++;
        }
      }
    } finally {
      _isSyncing = false;
    }

    return processed;
  }
}
