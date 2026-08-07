class SocialStatus {
  final bool blueskyConnected;
  final bool mastodonConnected;

  SocialStatus({
    required this.blueskyConnected,
    required this.mastodonConnected,
  });

  factory SocialStatus.fromJson(Map<String, dynamic> json) {
    return SocialStatus(
      blueskyConnected: json['blueskyConnected'] ?? json['bluesky'] == 'connected' ?? false,
      mastodonConnected: json['mastodonConnected'] ?? json['mastodon'] == 'connected' ?? false,
    );
  }
}
