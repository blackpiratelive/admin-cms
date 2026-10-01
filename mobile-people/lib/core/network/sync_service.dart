import 'dart:async';
import 'package:uuid/uuid.dart';
import '../storage/local_store.dart';
import '../models/offline_mutation.dart';
import 'api_service.dart';

class SyncService {
  static const _uuid = Uuid();
  static bool _isSyncing = false;
  static Timer? _syncTimer;

  /// Start periodic background auto-sync worker
  static void startPeriodicSync({Duration interval = const Duration(seconds: 30)}) {
    _syncTimer?.cancel();
    _syncTimer = Timer.periodic(interval, (_) {
      processQueue();
    });
  }

  /// Stop periodic background auto-sync worker
  static void stopPeriodicSync() {
    _syncTimer?.cancel();
    _syncTimer = null;
  }

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
    // Fire background sync attempt immediately
    unawaited(processQueue());
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
              final savedPerson = await ApiService.savePerson(mutation.payload);
              // If the created person had a temporary ID, purge it and remap remaining queue
              if (mutation.entityId.startsWith('temp_') && savedPerson.id != mutation.entityId) {
                await LocalStore.deleteCachedPerson(mutation.entityId);
                await LocalStore.replaceMutationEntityId(mutation.entityId, savedPerson.id);
              }
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
            case 'create_trip':
              final savedTrip = await ApiService.saveTrip(mutation.payload);
              if (mutation.entityId.startsWith('temp_') && savedTrip.id != mutation.entityId) {
                await LocalStore.deleteCachedTrip(mutation.entityId);
                await LocalStore.replaceMutationEntityId(mutation.entityId, savedTrip.id);
              }
              success = true;
              break;
            case 'update_trip':
              await ApiService.updateTrip(mutation.entityId, mutation.payload);
              success = true;
              break;
            case 'delete_trip':
              await ApiService.deleteTrip(mutation.entityId);
              success = true;
              break;
            case 'toggle_trip_favorite':
              await ApiService.toggleTripFavorite(
                mutation.entityId,
                mutation.payload['favorite'] == true,
              );
              success = true;
              break;
          }
        } on ApiException catch (e) {
          // If fatal client error (400 Bad Request, 404 Not Found, 422 Unprocessable),
          // evict the malformed/orphaned mutation so it does not permanently wedge the queue
          if (e.statusCode == 400 || e.statusCode == 404 || e.statusCode == 422) {
            await LocalStore.removeMutation(mutation.id);
            continue;
          }
          // Server errors (5xx) or auth errors: stop and retry later
          break;
        } catch (_) {
          // Network errors (SocketException, TimeoutException, etc.): stop processing and keep remaining queue
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
