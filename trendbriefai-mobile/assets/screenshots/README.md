# TrendBrief AI — App Store Screenshots Specification

## Overview

5 localized Vietnamese screenshots for Apple App Store and Google Play Store submission.
All screenshots use the app's indigo theme (#6366f1) and real Vietnamese content data.

---

## Required Dimensions

| Device | Resolution | Platform |
|--------|-----------|----------|
| iPhone 15 Pro Max | 1290 × 2796 px | App Store (6.7") |
| iPhone 11 Pro Max | 1242 × 2688 px | App Store (6.5") |
| Android Phone | 1080 × 1920 px (min) | Google Play |

- Format: PNG or JPEG, sRGB color space
- No alpha/transparency for App Store
- Max file size: 8 MB per image

---

## Global Design Guidelines

- **Primary color:** #6366f1 (Indigo) — used for caption backgrounds, accents, buttons
- **Dark variant:** #818cf8 — used for dark mode screenshot
- **Caption font:** Inter Bold, 48–56px, white (#FFFFFF) on indigo gradient background
- **Caption area:** Top 20% of screenshot, gradient from #6366f1 to #4f46e5
- **Device frame:** Optional thin device bezel mockup (iPhone 15 Pro Max style)
- **Status bar:** Show realistic iOS/Android status bar (time, signal, battery)
- **Language:** All UI text and captions in Vietnamese
- **Content:** Use real Vietnamese news data (tech, finance, lifestyle topics)

---

## Screenshot 1: Feed + Trending Carousel

**Caption:** "Tin tức AI tóm tắt 30 giây"

**Screen:** FeedScreen with TrendingCarousel visible at top

**Visible elements:**
- TrendingCarousel showing 2–3 trending article cards with thumbnails
  - Card 1: "Samsung ra mắt Galaxy S25 Ultra — giá từ 33 triệu" (🔥 Trending badge)
  - Card 2: "VN-Index vượt 1.300 điểm, nhà đầu tư lạc quan" (🔥 Trending badge)
- DynamicTopicChips row: AI, Tài chính, Phong cách sống, Drama, Công nghệ (AI chip selected/highlighted)
- 2 EnhancedFeedCard items below:
  - Card 1: Tech article with thumbnail, "2 giờ trước", "⏱ 30s", bookmark icon, share icon
    - 3 AI bullet points visible
    - "💡 Đáng chú ý vì..." reason line
  - Card 2: Finance article partially visible (scroll hint)
- Bottom navigation bar: Trang chủ (active), Bookmarks, Hồ sơ
- Search icon in top app bar

**Design notes:**
- Light mode theme
- Show the full richness of the feed experience
- Trending carousel should have slight horizontal scroll peek (3rd card partially visible)
- Topic chips should show the indigo highlight on the selected chip

---

## Screenshot 2: Article Detail with AI Bullets

**Caption:** "AI tóm tắt thông minh"

**Screen:** ArticleDetailScreen

**Visible elements:**
- App bar: back arrow, bookmark icon (outlined), share icon
- AI-generated title: "Apple ra mắt iPhone 16 Pro Max với chip A18 Pro — hiệu năng vượt trội"
- Metadata row: "VnExpress · 15/01/2025 · Công nghệ · ⏱ 45s"
- 3 AI summary bullets:
  - "• Chip A18 Pro tăng 40% hiệu năng GPU so với thế hệ trước"
  - "• Camera 48MP với khả năng quay video 8K"
  - "• Giá khởi điểm từ 34.99 triệu đồng tại Việt Nam"
- Reason section: "💡 Đáng chú ý vì đây là bước nhảy lớn nhất về hiệu năng chip trong 3 năm qua"
- "Đọc bài gốc" button (indigo, full-width, rounded)
- Article thumbnail/hero image at top (16:9 ratio)

**Design notes:**
- Light mode theme
- Emphasize the AI bullet points with subtle left border accent (#6366f1)
- "Đọc bài gốc" button should be prominent at bottom
- Clean, readable typography with good spacing

---

## Screenshot 3: Onboarding Topic Selection

**Caption:** "Chọn chủ đề yêu thích"

**Screen:** OnboardingScreen — Step 2 (Topic Selection)

**Visible elements:**
- Page indicator dots (3 dots, 2nd active)
- Heading: "Chọn chủ đề bạn quan tâm"
- Subheading: "Chọn ít nhất 1 chủ đề để cá nhân hóa tin tức"
- 9 topic ChoiceChips in a wrap layout:
  - 🤖 AI & Công nghệ (selected — indigo filled)
  - 💰 Tài chính & Kinh tế (selected — indigo filled)
  - 🎭 Drama & Giải trí
  - 💪 Sức khỏe
  - 🎮 Công nghệ
  - 💼 Nghề nghiệp
  - 🏃 Thể thao
  - 🎬 Giải trí
  - 🌿 Phong cách sống (selected — indigo filled)
- "Tiếp tục" button (indigo, full-width) at bottom
- Progress: "2/3" or step indicator

**Design notes:**
- Light mode theme
- Selected chips: filled indigo (#6366f1) with white text
- Unselected chips: outlined with gray border
- Show 3 chips selected to demonstrate the interaction
- Friendly, welcoming layout with generous spacing

---

## Screenshot 4: Search Results

**Caption:** "Tìm kiếm nhanh chóng"

**Screen:** SearchScreen with active search results

**Visible elements:**
- Search bar at top: text "trí tuệ nhân tạo" with clear button
- Results count hint: "12 kết quả"
- 3 search result cards:
  - Result 1: "Google DeepMind công bố Gemini 2.0 — AI đa phương thức mạnh nhất"
    - VnExpress · AI · 1 giờ trước
    - 2 bullet points visible
  - Result 2: "Việt Nam đặt mục tiêu top 50 AI toàn cầu vào 2030"
    - Tuổi Trẻ · Công nghệ · 3 giờ trước
    - 2 bullet points visible
  - Result 3: "ChatGPT đạt 200 triệu người dùng — OpenAI tăng trưởng kỷ lục"
    - Partially visible (scroll hint)
- Auto-focused keyboard NOT shown (to show more results)

**Design notes:**
- Light mode theme
- Search bar with subtle shadow/elevation
- Results should look clean and scannable
- Highlight matching text "trí tuệ nhân tạo" in results if possible (bold or indigo color)

---

## Screenshot 5: Push Notification + Dark Mode

**Caption:** "Thông báo tin nổi bật"

**Screen:** FeedScreen in dark mode with a push notification banner overlay

**Visible elements:**
- Dark mode theme active (surface: #1e1e2e, text: #e2e8f0)
- iOS-style push notification banner at top:
  - App icon (TrendBrief AI logo)
  - "TrendBrief AI"
  - "🔥 Tin nổi bật: Bitcoin vượt $100,000 lần đầu tiên trong lịch sử"
  - "Bấm để đọc ngay"
- Behind the notification, FeedScreen in dark mode:
  - TrendingCarousel with dark card backgrounds
  - 1–2 EnhancedFeedCard items in dark theme
  - Topic chips in dark variant
- Bottom navigation bar in dark theme

**Design notes:**
- Dark mode theme (#1e1e2e background, #818cf8 primary accents)
- Push notification banner should look native iOS (frosted glass effect)
- Contrast between the bright notification and dark feed demonstrates both features
- Show the dark mode is polished and complete, not just an inverted color scheme

---

## File Naming Convention

```
assets/screenshots/
├── README.md                          (this file)
├── screenshot_01_feed_trending.png    (to be generated)
├── screenshot_02_article_detail.png   (to be generated)
├── screenshot_03_onboarding_topics.png (to be generated)
├── screenshot_04_search_results.png   (to be generated)
└── screenshot_05_notification_dark.png (to be generated)
```

Each screenshot should be exported in all required dimensions:

```
screenshot_01_feed_trending_1290x2796.png   (iPhone 15 Pro Max)
screenshot_01_feed_trending_1242x2688.png   (iPhone 11 Pro Max)
screenshot_01_feed_trending_1080x1920.png   (Android)
```

---

## Production Workflow

1. Build the app in release mode on a real device or high-fidelity simulator
2. Populate with the sample data described above for each screenshot
3. Capture at native resolution (no upscaling)
4. Add caption overlay in Figma/Sketch using the design guidelines above
5. Export in PNG format, sRGB, no transparency
6. Verify all Vietnamese text renders correctly with diacritical marks
7. Test readability at App Store thumbnail size (~200px wide)
