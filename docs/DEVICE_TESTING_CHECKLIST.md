# TrendBrief AI — Device Testing Checklist

> Checklist dùng để kiểm tra trên thiết bị thật trước khi phát hành.
> Đánh dấu ✅ khi pass, ❌ khi fail, ⏭️ khi skip (ghi lý do).

---

## 1. Firebase Crashlytics

### Android
- [ ] App khởi động thành công, không crash
- [ ] Force crash (throw exception) → crash report xuất hiện trong Firebase Console trong vòng 5 phút
- [ ] Non-fatal error (recordError) → hiển thị trong Crashlytics Issues
- [ ] ANR detection — block main thread > 5s → ANR report xuất hiện
- [ ] User identifier (setUserIdentifier) hiển thị đúng trong crash session
- [ ] Custom keys (setCustomKey) hiển thị trong crash context
- [ ] Crashlytics collection disabled trong debug mode (kDebugMode)

### iOS
- [ ] App khởi động thành công, không crash
- [ ] Force crash → crash report xuất hiện trong Firebase Console
- [ ] Non-fatal error → hiển thị trong Crashlytics Issues
- [ ] dSYM upload thành công (symbolicated crash reports)
- [ ] User identifier hiển thị đúng trong crash session

---

## 2. Firebase Analytics

### Events — Android & iOS
- [ ] `screen_view` — tự động log khi navigate giữa các màn hình (via FirebaseAnalyticsObserver)
- [ ] `screen_view` — verify trong DebugView: FeedScreen, ArticleDetailScreen, SearchScreen, ProfileScreen, BookmarksScreen
- [ ] `article_view` — log khi mở article detail, params: `article_id`, `topic`
- [ ] `article_share` — log khi share article, params: `article_id`, `topic`
- [ ] `bookmark_add` — log khi bookmark article, params: `article_id`, `topic`
- [ ] Events xuất hiện trong Firebase Console > Analytics > DebugView (real-time)
- [ ] Events xuất hiện trong Analytics > Events (sau 24h)

### User Properties
- [ ] User ID được set sau khi login
- [ ] Theme preference (light/dark) tracked

---

## 3. Push Notifications (FCM)

### Token Registration
- [ ] FCM token được generate thành công sau khi grant permission
- [ ] Token được gửi lên backend qua `POST /api/notifications/register`
- [ ] Token refresh → token mới được gửi lên backend tự động

### Permission Flow
- [ ] Android: notification permission dialog hiển thị (Android 13+)
- [ ] iOS: notification permission dialog hiển thị
- [ ] Deny permission → app hoạt động bình thường, không crash
- [ ] Revoke permission trong Settings → app xử lý gracefully

### Foreground
- [ ] Nhận notification khi app đang mở → hiển thị local notification hoặc in-app banner
- [ ] Tap notification → navigate đến article detail đúng

### Background
- [ ] Nhận notification khi app ở background → hiển thị trong notification tray
- [ ] Tap notification → app resume + navigate đến article detail đúng

### Terminated (Cold Start)
- [ ] Nhận notification khi app đã bị kill → hiển thị trong notification tray
- [ ] Tap notification → app launch + navigate đến article detail đúng

### Notification Types
- [ ] Trending notification — hiển thị title + body đúng
- [ ] Daily digest notification — hiển thị đúng
- [ ] Topic update notification — hiển thị đúng

---

## 4. Dark Mode / Light Mode

### Android
- [ ] Default theme theo system setting
- [ ] Toggle dark mode trong Profile → UI chuyển trong < 300ms
- [ ] Theme persist sau khi restart app
- [ ] Tất cả màn hình render đúng trong light mode (text readable, contrast OK)
- [ ] Tất cả màn hình render đúng trong dark mode (text readable, contrast OK)
- [ ] Status bar + navigation bar color phù hợp với theme

### iOS
- [ ] Default theme theo system setting
- [ ] Toggle dark mode trong Profile → UI chuyển trong < 300ms
- [ ] Theme persist sau khi restart app
- [ ] Tất cả màn hình render đúng trong cả 2 mode
- [ ] Safe area + notch handling đúng trong cả 2 mode

---

## 5. Onboarding Flow

### Android & iOS
- [ ] First launch → hiển thị OnboardingScreen (không phải LoginScreen)
- [ ] Screen 1: Welcome — hiển thị value proposition, nút "Bắt đầu"
- [ ] Screen 2: Topic Selection — hiển thị dynamic chips từ API, chọn ≥1 topic mới enable nút tiếp
- [ ] Screen 2: Chọn 0 topic → nút disabled / hiển thị warning
- [ ] Screen 3: Completion — nút "Khám phá ngay →"
- [ ] Tap "Khám phá ngay" → POST /api/users/me/onboarding → navigate to Feed
- [ ] Restart app → không hiển thị onboarding lần 2
- [ ] Swipe giữa các screen mượt, không lag

---

## 6. Feed Screen

### Loading
- [ ] First load → hiển thị 3 skeleton cards (shimmer animation)
- [ ] Skeleton fade transition to content trong < 200ms
- [ ] Trending carousel hiển thị phía trên feed (tối đa 10 articles)

### Scrolling
- [ ] Infinite scroll — load thêm articles khi scroll đến cuối
- [ ] Scroll mượt, không jank (60fps)
- [ ] Thumbnail images load progressively (cached_network_image)

### Pull-to-Refresh
- [ ] Pull down → refresh feed + trending carousel
- [ ] Haptic feedback khi pull-to-refresh
- [ ] Loading indicator hiển thị đúng

### Topic Filter
- [ ] Dynamic topic chips hiển thị từ API
- [ ] Tap topic → filter feed theo topic
- [ ] Tap "Tất cả" → hiển thị tất cả articles

### Feed Cards
- [ ] Thumbnail 16:9 hoặc gradient placeholder với topic icon
- [ ] Relative time hiển thị đúng ("2 giờ trước", "vừa xong")
- [ ] Reading time badge hiển thị
- [ ] "🔥 Trending" badge cho top 5 articles
- [ ] Fade-in/slide-up animation khi card xuất hiện
- [ ] Press-down scale animation khi tap

---

## 7. Article Detail

### Display
- [ ] AI title, source, date, topic, reading time hiển thị đúng
- [ ] 3 summary bullets hiển thị đúng
- [ ] Reason ("Đáng chú ý vì...") hiển thị đúng
- [ ] Vietnamese text render đúng (diacritical marks)
- [ ] Related articles section hiển thị bên dưới bài viết (tối đa 5 bài cùng chủ đề)
- [ ] Tap related article → navigate to article detail đúng

### Actions
- [ ] "Đọc bài gốc" → mở in-app browser với URL gốc
- [ ] Bookmark button → toggle bookmark, haptic feedback
- [ ] Share button → platform share sheet với format: "{title}\n\nĐọc thêm: {url}\n\nvia TrendBrief AI"
- [ ] View interaction recorded khi mở article

### Reactions
- [ ] Reaction bar hiển thị 5 emoji: ❤️ 😂 😮 😢 😡
- [ ] Tap reaction → gửi reaction, animation feedback
- [ ] Tap lại reaction đã chọn → remove reaction
- [ ] Reaction counts hiển thị đúng, cập nhật real-time
- [ ] Chỉ được chọn 1 reaction per article

### Analytics
- [ ] `article_view` event logged
- [ ] `article_share` event logged khi share
- [ ] `bookmark_add` event logged khi bookmark
- [ ] `reaction_add` event logged khi thả reaction

---

## 8. Search (Meilisearch-powered)

### Android & iOS
- [ ] Search icon trên Feed → navigate to SearchScreen
- [ ] Text input auto-focused
- [ ] Nhập < 2 ký tự → không trigger search
- [ ] Nhập ≥ 2 ký tự → trigger search, hiển thị results
- [ ] Typo-tolerant search hoạt động (ví dụ: "cong nghe" → "Công nghệ")
- [ ] Infinite scroll pagination cho results
- [ ] Empty state hiển thị khi không có kết quả
- [ ] Error state hiển thị khi API fail, nút "Thử lại"
- [ ] Vietnamese input (diacritical marks) hoạt động đúng

---

## 9. Offline Mode

### Android & iOS
- [ ] Bật airplane mode → "Không có kết nối mạng" banner hiển thị
- [ ] Feed hiển thị cached data với badge "Dữ liệu cũ"
- [ ] Tắt airplane mode → banner biến mất, feed refresh
- [ ] Search disabled khi offline
- [ ] Share disabled khi offline
- [ ] Pull-to-refresh khi offline → hiển thị error message
- [ ] Article detail từ cache vẫn hiển thị được

---

## 10. Deep Links

### Android
- [ ] `trendbriefai.vn/article/{id}` → mở app + navigate to article detail
- [ ] `trendbriefai.vn/ref/{code}` → mở app store hoặc app
- [ ] Deep link khi app terminated → cold start + navigate đúng

### iOS
- [ ] Universal link `trendbriefai.vn/article/{id}` → mở app + navigate to article detail
- [ ] Universal link khi app terminated → cold start + navigate đúng
- [ ] apple-app-site-association file configured đúng

---

## 11. Bookmarks Screen

- [ ] Hiển thị danh sách bookmarked articles
- [ ] Remove bookmark → article biến mất khỏi list
- [ ] Empty state khi chưa có bookmark
- [ ] Error state với nút "Thử lại"

---

## 12. Profile Screen

- [ ] Reading stats hiển thị: articles read, bookmarks, days active
- [ ] Reading history link → navigate to ReadingHistoryScreen
- [ ] Referral section hiển thị mã giới thiệu cá nhân
- [ ] Copy referral code → clipboard, toast confirmation
- [ ] Share referral link → platform share sheet
- [ ] Referral stats hiển thị: số bạn bè đã mời, rewards earned
- [ ] Premium status hiển thị (Free / Premium, ngày hết hạn nếu có)
- [ ] "Nâng cấp Premium" button → navigate to PremiumScreen (nếu chưa premium)
- [ ] Dark mode toggle hoạt động
- [ ] Notification toggle hoạt động
- [ ] App version hiển thị đúng

---

## 13. Reading History

- [ ] Paginated list of viewed articles, sorted by most recent
- [ ] Infinite scroll pagination
- [ ] Tap article → navigate to article detail
- [ ] Empty state khi chưa đọc bài nào

---

## 14. Premium / Subscription

### Plan Selection
- [ ] Premium screen hiển thị các gói: Monthly (49,000 VND), Yearly (399,000 VND)
- [ ] Gói yearly hiển thị badge "Tiết kiệm X%"
- [ ] Feature comparison hiển thị rõ ràng (Free vs Premium)

### Payment — MoMo
- [ ] Chọn gói + MoMo → redirect to MoMo app/web
- [ ] Thanh toán thành công → quay lại app, premium status cập nhật
- [ ] Thanh toán thất bại → hiển thị error message, nút "Thử lại"

### Payment — VNPay
- [ ] Chọn gói + VNPay → redirect to VNPay gateway
- [ ] Thanh toán thành công → quay lại app, premium status cập nhật
- [ ] Thanh toán thất bại → hiển thị error message

### Payment — Stripe
- [ ] Chọn gói + Stripe → redirect to Stripe Checkout
- [ ] Thanh toán thành công → quay lại app, premium status cập nhật

### Premium Features
- [ ] Premium user: không hiển thị quảng cáo trong feed
- [ ] Premium user: truy cập tính năng độc quyền
- [ ] Premium badge hiển thị trong Profile
- [ ] Hết hạn premium → fallback về Free, hiển thị thông báo

---

## 15. Referral System

- [ ] Mã giới thiệu unique hiển thị trong Profile
- [ ] Deep link `trendbriefai.vn/ref/{code}` → mở app store hoặc app
- [ ] Bạn bè cài app qua referral link → referral được ghi nhận
- [ ] Referral stats cập nhật đúng (số lượt giới thiệu thành công)
- [ ] Rewards hiển thị đúng (nếu có chương trình thưởng)

---

## 16. Performance

### Android
- [ ] Cold start < 3s
- [ ] Feed scroll 60fps (no jank)
- [ ] Memory usage stable (no leaks sau 5 phút sử dụng)
- [ ] Battery drain hợp lý

### iOS
- [ ] Cold start < 3s
- [ ] Feed scroll 60fps (no jank)
- [ ] Memory usage stable
- [ ] Battery drain hợp lý

---

## 17. Device Compatibility

### Android
- [ ] Android 8.0 (API 26) — minimum supported
- [ ] Android 13 (API 33) — notification permission
- [ ] Android 14 (API 34) — latest
- [ ] Small screen (5") — layout không bị cắt
- [ ] Large screen (6.7") — layout stretch hợp lý
- [ ] Tablet (10") — layout responsive

### iOS
- [ ] iOS 14 — minimum supported
- [ ] iOS 17 — latest
- [ ] iPhone SE (small screen) — layout OK
- [ ] iPhone 15 Pro Max (large screen) — layout OK
- [ ] iPad — layout responsive
- [ ] Notch / Dynamic Island — safe area handling

---

## Test Environment

| Field | Value |
|-------|-------|
| Tester | |
| Date | |
| Android device | |
| Android OS version | |
| iOS device | |
| iOS version | |
| App version | |
| Backend environment | |
| Firebase project | |

---

## Notes

_Ghi chú thêm về bugs, issues, hoặc observations:_

1.
2.
3.
