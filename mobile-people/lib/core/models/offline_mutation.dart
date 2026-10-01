class OfflineMutation {
  final String id;
  final String type; // person: 'create_person','update_person','delete_person','toggle_favorite','add_connection','remove_connection' | trip: 'create_trip','update_trip','delete_trip','toggle_trip_favorite'
  final String entityId;
  final Map<String, dynamic> payload;
  final String timestamp;

  const OfflineMutation({
    required this.id,
    required this.type,
    required this.entityId,
    required this.payload,
    required this.timestamp,
  });

  factory OfflineMutation.fromJson(Map<String, dynamic> json) {
    return OfflineMutation(
      id: json['id'] as String,
      type: json['type'] as String,
      entityId: json['entityId'] as String? ?? '',
      payload: (json['payload'] as Map<String, dynamic>?) ?? {},
      timestamp: json['timestamp'] as String? ?? DateTime.now().toIso8601String(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'type': type,
      'entityId': entityId,
      'payload': payload,
      'timestamp': timestamp,
    };
  }
}
