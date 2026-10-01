import 'package:flutter/cupertino.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../core/models/trip_day.dart';
import '../core/services/image_cache_manager.dart';
import '../core/theme/cupertino_theme.dart';
import 'image_lightbox.dart';

/// Read-only day-by-day itinerary timeline (mirrors the web TripItineraryTab).
class TripDayTimeline extends StatelessWidget {
  final List<TripDay> days;

  const TripDayTimeline({super.key, required this.days});

  static const Map<String, IconData> _transportIcons = {
    'walk': CupertinoIcons.person,
    'bike': CupertinoIcons.cube_box,
    'bus': CupertinoIcons.bus,
    'train': CupertinoIcons.tram_fill,
    'flight': CupertinoIcons.airplane,
    'car': CupertinoIcons.car_detailed,
    'taxi': CupertinoIcons.car,
    'boat': CupertinoIcons.drop,
    'other': CupertinoIcons.arrow_right,
  };

  @override
  Widget build(BuildContext context) {
    if (days.isEmpty) {
      return _emptyState(context);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final day in days) ...[
          _buildDayCard(context, day),
          const SizedBox(height: 12),
        ],
      ],
    );
  }

  Widget _emptyState(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(28),
      alignment: Alignment.center,
      child: Column(
        children: [
          const Icon(CupertinoIcons.calendar_badge_plus, size: 40, color: CupertinoColors.systemGrey),
          const SizedBox(height: 10),
          Text(
            'No itinerary days yet',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: AppCupertinoTheme.label(context),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Days are planned from the web CMS. They will appear here once added.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: AppCupertinoTheme.secondary(context)),
          ),
        ],
      ),
    );
  }

  Widget _buildDayCard(BuildContext context, TripDay day) {
    final labelColor = AppCupertinoTheme.label(context);
    final secondaryColor = AppCupertinoTheme.secondary(context);
    final spend = formatCostTotals(day.costTotals);

    final sections = <Widget>[];
    if (day.transport.isNotEmpty) {
      sections.add(_section(context, 'Transport', CupertinoIcons.arrow_right_arrow_left,
          day.transport.map((l) => _transportRow(context, l)).toList()));
    }
    if (day.meals.isNotEmpty) {
      sections.add(_section(context, 'Food', CupertinoIcons.square_favorites_alt,
          day.meals.map((m) => _mealRow(context, m)).toList()));
    }
    if (day.activities.isNotEmpty) {
      sections.add(_section(context, 'Activities', CupertinoIcons.star,
          day.activities.map((a) => _activityRow(context, a)).toList()));
    }
    if (!day.accommodation.isEmpty) {
      sections.add(_section(context, 'Stay', CupertinoIcons.bed_double,
          [_accommodationRow(context, day.accommodation)]));
    }

    return Container(
      decoration: BoxDecoration(
        color: AppCupertinoTheme.cardBackground.resolveFrom(context),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppCupertinoTheme.cardBorder.resolveFrom(context), width: 0.6),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row: Day N badge + title/place + spend
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  gradient: AppCupertinoTheme.brandGradient,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  'Day ${day.dayNumber}',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: CupertinoColors.white,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      day.title?.isNotEmpty == true
                          ? day.title!
                          : (day.primaryLocationName ?? 'Untitled day'),
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: labelColor),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (day.date != null && day.date!.isNotEmpty)
                      Text(day.date!, style: TextStyle(fontSize: 12, color: secondaryColor)),
                  ],
                ),
              ),
              if (spend.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppCupertinoTheme.subtleFill.resolveFrom(context),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    spend,
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: labelColor),
                  ),
                ),
            ],
          ),

          // Glance chips (weather / mood / counts)
          if (_hasGlance(day)) ...[
            const SizedBox(height: 10),
            _glanceChips(context, day),
          ],

          // Structured sections
          for (final s in sections) ...[const SizedBox(height: 12), s],

          // Notes
          if (day.notesMarkdown != null && day.notesMarkdown!.trim().isNotEmpty) ...[
            const SizedBox(height: 12),
            MarkdownBody(data: day.notesMarkdown!),
          ],

          // Photos
          if (day.photos.isNotEmpty) ...[
            const SizedBox(height: 12),
            _photoStrip(context, day.photos),
          ],
        ],
      ),
    );
  }

  bool _hasGlance(TripDay day) =>
      (day.weather != null && day.weather!.isNotEmpty) ||
      day.mood != null ||
      day.transport.isNotEmpty ||
      day.meals.isNotEmpty ||
      day.activities.isNotEmpty ||
      day.photos.isNotEmpty;

  Widget _glanceChips(BuildContext context, TripDay day) {
    final chips = <Widget>[];
    if (day.transport.isNotEmpty) {
      chips.add(_chip(context, CupertinoIcons.arrow_right_arrow_left, '${day.transport.length} transport'));
    }
    if (day.meals.isNotEmpty) {
      chips.add(_chip(context, CupertinoIcons.square_favorites_alt, '${day.meals.length} ${day.meals.length == 1 ? 'meal' : 'meals'}'));
    }
    if (day.activities.isNotEmpty) {
      chips.add(_chip(context, CupertinoIcons.star, '${day.activities.length} ${day.activities.length == 1 ? 'activity' : 'activities'}'));
    }
    if (!day.accommodation.isEmpty) {
      chips.add(_chip(context, CupertinoIcons.bed_double, 'stay'));
    }
    if (day.photos.isNotEmpty) {
      chips.add(_chip(context, CupertinoIcons.photo, '${day.photos.length} ${day.photos.length == 1 ? 'photo' : 'photos'}'));
    }
    if (day.weather != null && day.weather!.isNotEmpty) {
      chips.add(_chip(context, CupertinoIcons.cloud_sun, day.weather!));
    }
    if (day.mood != null) {
      chips.add(_chip(context, CupertinoIcons.smiley, 'Mood ${day.mood}/5'));
    }
    return Wrap(spacing: 8, runSpacing: 6, children: chips);
  }

  Widget _chip(BuildContext context, IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppCupertinoTheme.subtleFill.resolveFrom(context),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: AppCupertinoTheme.secondary(context)),
          const SizedBox(width: 4),
          Text(text, style: TextStyle(fontSize: 11.5, color: AppCupertinoTheme.secondary(context))),
        ],
      ),
    );
  }

  Widget _section(BuildContext context, String title, IconData icon, List<Widget> rows) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 13, color: AppCupertinoTheme.brandAccent),
            const SizedBox(width: 6),
            Text(
              title.toUpperCase(),
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.3,
                color: AppCupertinoTheme.secondary(context),
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ...rows,
      ],
    );
  }

  Widget _costLabel(BuildContext context, num? cost, String? currency) {
    if (cost == null || cost == 0) return const SizedBox.shrink();
    final cur = (currency ?? '').trim();
    return Text(
      formatCostTotals({cur: cost}),
      style: TextStyle(
        fontSize: 12.5,
        fontWeight: FontWeight.w600,
        color: AppCupertinoTheme.label(context),
      ),
    );
  }

  Widget _rowShell(BuildContext context, {required Widget child, Widget? trailing}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: child),
          if (trailing != null) ...[const SizedBox(width: 8), trailing],
        ],
      ),
    );
  }

  Widget _transportRow(BuildContext context, TransportLeg leg) {
    final labelColor = AppCupertinoTheme.label(context);
    final icon = _transportIcons[leg.mode] ?? CupertinoIcons.arrow_right;
    final route = leg.routeLabel.isNotEmpty ? leg.routeLabel : leg.mode;
    return _rowShell(
      context,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 14, color: AppCupertinoTheme.secondary(context)),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              route,
              style: TextStyle(fontSize: 13.5, color: labelColor),
            ),
          ),
        ],
      ),
      trailing: _costLabel(context, leg.cost, leg.currency),
    );
  }

  Widget _mealRow(BuildContext context, MealEntry meal) {
    final labelColor = AppCupertinoTheme.label(context);
    final secondaryColor = AppCupertinoTheme.secondary(context);
    final title = [
      meal.type[0].toUpperCase() + meal.type.substring(1),
      if (meal.place != null && meal.place!.isNotEmpty) meal.place,
    ].join(' · ');
    return _rowShell(
      context,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: TextStyle(fontSize: 13.5, color: labelColor, fontWeight: FontWeight.w500)),
          if (meal.dishes != null && meal.dishes!.isNotEmpty)
            Text(meal.dishes!, style: TextStyle(fontSize: 12.5, color: secondaryColor)),
        ],
      ),
      trailing: _costLabel(context, meal.cost, meal.currency),
    );
  }

  Widget _activityRow(BuildContext context, ActivityEntry act) {
    final labelColor = AppCupertinoTheme.label(context);
    final secondaryColor = AppCupertinoTheme.secondary(context);
    final subtitle = [
      if (act.time != null && act.time!.isNotEmpty) act.time,
      if (act.locationName != null && act.locationName!.isNotEmpty) act.locationName,
    ].join(' · ');
    return _rowShell(
      context,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(act.title.isNotEmpty ? act.title : 'Activity',
              style: TextStyle(fontSize: 13.5, color: labelColor, fontWeight: FontWeight.w500)),
          if (subtitle.isNotEmpty)
            Text(subtitle, style: TextStyle(fontSize: 12.5, color: secondaryColor)),
        ],
      ),
      trailing: _costLabel(context, act.cost, act.currency),
    );
  }

  Widget _accommodationRow(BuildContext context, Accommodation acc) {
    final labelColor = AppCupertinoTheme.label(context);
    final name = acc.name?.isNotEmpty == true
        ? acc.name!
        : (acc.locationName?.isNotEmpty == true ? acc.locationName! : 'Stay');
    return _rowShell(
      context,
      child: Text(name, style: TextStyle(fontSize: 13.5, color: labelColor)),
      trailing: _costLabel(context, acc.cost, acc.currency),
    );
  }

  Widget _photoStrip(BuildContext context, List<DayPhoto> photos) {
    final urls = photos.map((p) => p.url).where((u) => u.isNotEmpty).toList();
    return SizedBox(
      height: 76,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: urls.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, idx) {
          return GestureDetector(
            onTap: () => ImageLightbox.show(context, urls, initialIndex: idx),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: CachedNetworkImage(
                cacheManager: PeopleImageCacheManager.instance,
                imageUrl: urls[idx],
                width: 76,
                height: 76,
                fit: BoxFit.cover,
                errorWidget: (_, _, _) => Container(
                  width: 76,
                  height: 76,
                  color: AppCupertinoTheme.subtleFill.resolveFrom(context),
                  child: const Icon(CupertinoIcons.photo, size: 20, color: CupertinoColors.systemGrey),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
