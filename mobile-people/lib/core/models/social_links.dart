class SocialLinks {
  final String? instagram;
  final String? facebook;
  final String? github;
  final String? linkedin;
  final String? website;

  const SocialLinks({
    this.instagram,
    this.facebook,
    this.github,
    this.linkedin,
    this.website,
  });

  factory SocialLinks.fromJson(Map<String, dynamic> json) {
    return SocialLinks(
      instagram: _clean(json['instagram']),
      facebook: _clean(json['facebook']),
      github: _clean(json['github']),
      linkedin: _clean(json['linkedin']),
      website: _clean(json['website']),
    );
  }

  static String? _clean(dynamic val) {
    if (val == null) return null;
    final str = val.toString().trim();
    return str.isEmpty ? null : str;
  }

  Map<String, dynamic> toJson() {
    return {
      'instagram': instagram ?? '',
      'facebook': facebook ?? '',
      'github': github ?? '',
      'linkedin': linkedin ?? '',
      'website': website ?? '',
    };
  }

  bool get isEmpty =>
      (instagram == null || instagram!.isEmpty) &&
      (facebook == null || facebook!.isEmpty) &&
      (github == null || github!.isEmpty) &&
      (linkedin == null || linkedin!.isEmpty) &&
      (website == null || website!.isEmpty);

  bool get isNotEmpty => !isEmpty;

  String getInstagramUrl() {
    if (instagram == null || instagram!.isEmpty) return '';
    return instagram!.startsWith('http') ? instagram! : 'https://instagram.com/$instagram';
  }

  String getFacebookUrl() {
    if (facebook == null || facebook!.isEmpty) return '';
    return facebook!.startsWith('http') ? facebook! : 'https://facebook.com/$facebook';
  }

  String getGithubUrl() {
    if (github == null || github!.isEmpty) return '';
    return github!.startsWith('http') ? github! : 'https://github.com/$github';
  }

  String getLinkedinUrl() {
    if (linkedin == null || linkedin!.isEmpty) return '';
    return linkedin!.startsWith('http') ? linkedin! : 'https://linkedin.com/in/$linkedin';
  }

  String getWebsiteUrl() {
    if (website == null || website!.isEmpty) return '';
    return website!.startsWith('http') ? website! : 'https://$website';
  }
}
