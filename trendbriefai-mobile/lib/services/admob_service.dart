/// AdMob integration service (Task 33.1)
/// Note: Requires google_mobile_ads package and real ad unit IDs.
class AdMobService {
  static const _bannerAdUnitId = 'ca-app-pub-XXXXXXXX/YYYYYYYY'; // Replace with real ID

  // Placeholder — actual implementation requires google_mobile_ads SDK
  static bool get isAdFree => false; // Check premium status

  static String get bannerAdUnitId => _bannerAdUnitId;
}
