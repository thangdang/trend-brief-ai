# Requirements Document

## Introduction

TrendBrief AI is a Vietnamese AI-summarized news app targeting Gen Z users (18–30). The app currently provides a basic feed with AI-generated summaries, bookmarks, and topic filtering. This requirements document covers three improvement areas: (1) UI/UX enhancements to create a polished, engaging mobile experience, (2) features to increase App Store and Google Play ratings, and (3) functionality improvements to deliver more value to users. The goal is to transform TrendBrief AI from an MVP into a production-quality app that retains users and earns high store ratings.

## Glossary

- **Mobile_App**: The TrendBrief AI Flutter mobile application
- **Feed_Screen**: The main scrollable list of AI-summarized news articles
- **Feed_Card**: A single article card displayed in the Feed_Screen showing title, summary bullets, reason, and action buttons
- **Topic_Chip**: A selectable filter chip representing a news category (AI, Finance, Lifestyle, Drama)
- **Onboarding_Flow**: A sequence of screens shown to first-time users to select interests and learn app features
- **Article_Detail_View**: An in-app screen that displays the full AI summary, metadata, and reading experience for a single article
- **Search_Screen**: An in-app screen allowing users to search articles by keyword
- **Trending_Section**: A UI section displaying the most interacted-with articles in the last 24 hours
- **In_App_Review_Prompt**: A system dialog requesting the user to rate the app on the App Store or Google Play
- **Share_Service**: The component responsible for sharing article content via platform share sheet
- **Dark_Mode_Toggle**: A user-facing setting to manually switch between light and dark themes
- **Design_System**: A consistent set of colors, typography, spacing, and component styles used across the Mobile_App
- **Backend_API**: The Express.js/TypeScript REST API serving feed, search, trending, bookmarks, and user data
- **Error_State_View**: A UI component displayed when a network request fails, offering retry functionality
- **Skeleton_Loader**: A placeholder animation shown while content is loading, mimicking the layout of the final content
- **Haptic_Feedback**: Subtle vibration responses triggered by user interactions such as bookmarking or pulling to refresh
- **Reading_History_Screen**: A screen displaying previously viewed articles
- **Notification_Service**: The backend and mobile component responsible for sending and receiving push notifications

## Requirements

### Requirement 1: Design System and Theming

**User Story:** As a user, I want the app to have a visually consistent and modern design, so that the experience feels polished and trustworthy.

#### Acceptance Criteria

1. THE Design_System SHALL define a custom color palette with primary, secondary, tertiary, surface, and error colors for both light and dark themes
2. THE Design_System SHALL define a typography scale with at least 5 text styles (headline, title, body, label, caption) using a Vietnamese-friendly font
3. THE Mobile_App SHALL apply the Design_System consistently across all screens and components
4. WHEN the user selects dark mode from the Dark_Mode_Toggle, THE Mobile_App SHALL switch to the dark theme within 300ms without restarting
5. WHEN the user selects light mode from the Dark_Mode_Toggle, THE Mobile_App SHALL switch to the light theme within 300ms without restarting
6. THE Mobile_App SHALL persist the user's theme preference across app restarts

### Requirement 2: Onboarding Flow for New Users

**User Story:** As a new user, I want to be guided through selecting my interests when I first open the app, so that my feed is personalized from the start.

#### Acceptance Criteria

1. WHEN a user opens the Mobile_App for the first time after registration, THE Onboarding_Flow SHALL display a welcome screen with the app's value proposition
2. WHEN the user proceeds from the welcome screen, THE Onboarding_Flow SHALL present a topic selection screen with all available topics displayed as selectable cards
3. THE Onboarding_Flow SHALL require the user to select at least 1 topic before proceeding
4. WHEN the user completes topic selection, THE Onboarding_Flow SHALL save the selected interests to the Backend_API and navigate to the Feed_Screen
5. THE Onboarding_Flow SHALL display a maximum of 3 screens (welcome, topic selection, completion)
6. THE Mobile_App SHALL show the Onboarding_Flow only once per user account

### Requirement 3: Enhanced Feed Card Design

**User Story:** As a user, I want feed cards to be visually rich and informative, so that I can quickly scan and decide which articles to read.

#### Acceptance Criteria

1. WHEN an article has a thumbnail image available, THE Feed_Card SHALL display the thumbnail image with a 16:9 aspect ratio at the top of the card
2. WHEN an article has no thumbnail image, THE Feed_Card SHALL display a gradient placeholder with the topic icon
3. THE Feed_Card SHALL display the relative time since publication (e.g., "2 giờ trước") instead of an absolute timestamp
4. THE Feed_Card SHALL display the reading time estimate in a visible badge
5. WHEN an article is among the top 5 trending articles, THE Feed_Card SHALL display a "🔥 Trending" badge
6. THE Feed_Card SHALL animate into view with a fade-in and slide-up transition when first appearing during scroll

### Requirement 4: Article Detail View

**User Story:** As a user, I want to read the full AI summary in-app with a comfortable reading experience, so that I do not need to leave the app for every article.

#### Acceptance Criteria

1. WHEN the user taps on a Feed_Card, THE Mobile_App SHALL navigate to the Article_Detail_View with a slide-up transition
2. THE Article_Detail_View SHALL display the AI title, source, publication date, topic badge, reading time, summary bullets, and reason section
3. THE Article_Detail_View SHALL provide a "Đọc bài gốc" button that opens the original article URL in an in-app browser
4. THE Article_Detail_View SHALL provide bookmark and share action buttons in the app bar
5. WHEN the user opens the Article_Detail_View, THE Mobile_App SHALL record a "view" interaction via the Backend_API
6. THE Article_Detail_View SHALL support vertical scrolling for articles with long summaries

### Requirement 5: Search Functionality

**User Story:** As a user, I want to search for articles by keyword, so that I can find specific topics or news I am interested in.

#### Acceptance Criteria

1. WHEN the user taps the search icon on the Feed_Screen, THE Mobile_App SHALL navigate to the Search_Screen with a text input field auto-focused
2. WHEN the user submits a search query of at least 2 characters, THE Search_Screen SHALL display matching articles from the Backend_API within 3 seconds
3. WHEN no articles match the search query, THE Search_Screen SHALL display an empty state message "Không tìm thấy kết quả"
4. THE Search_Screen SHALL support pagination for search results using infinite scroll
5. IF the search request fails due to a network error, THEN THE Search_Screen SHALL display the Error_State_View with a retry button

### Requirement 6: Trending Section

**User Story:** As a user, I want to see what articles are trending, so that I can stay informed about popular topics.

#### Acceptance Criteria

1. THE Feed_Screen SHALL display a horizontal scrollable Trending_Section above the main feed list
2. THE Trending_Section SHALL display up to 10 trending articles fetched from the Backend_API trending endpoint
3. WHEN the user taps a trending article card, THE Mobile_App SHALL navigate to the Article_Detail_View for that article
4. THE Trending_Section SHALL refresh its data when the user performs a pull-to-refresh on the Feed_Screen
5. IF the trending data request fails, THEN THE Trending_Section SHALL hide itself without affecting the main feed

### Requirement 7: Share Functionality

**User Story:** As a user, I want to share interesting articles with friends, so that I can spread useful information.

#### Acceptance Criteria

1. WHEN the user taps the share button on a Feed_Card or Article_Detail_View, THE Share_Service SHALL open the platform share sheet with the article title and original URL
2. THE Share_Service SHALL format the shared content as: "{AI title}\n\nĐọc thêm: {article URL}\n\nvia TrendBrief AI"
3. WHEN the user completes a share action, THE Mobile_App SHALL record a "share" interaction via the Backend_API

### Requirement 8: In-App Review Prompt

**User Story:** As a product owner, I want to prompt engaged users to rate the app on the store, so that the app's store rating increases.

#### Acceptance Criteria

1. WHEN a user has opened the Mobile_App on at least 5 separate days AND has viewed at least 20 articles, THE Mobile_App SHALL trigger the In_App_Review_Prompt
2. THE Mobile_App SHALL use the platform-native in-app review API (StoreKit for iOS, Google Play In-App Review API for Android)
3. THE Mobile_App SHALL trigger the In_App_Review_Prompt a maximum of 1 time per 90-day period per user
4. THE Mobile_App SHALL persist the last prompt date and article view count locally to enforce the frequency limit
5. IF the platform-native review API is unavailable, THEN THE Mobile_App SHALL skip the prompt without displaying an error

### Requirement 9: Skeleton Loading States

**User Story:** As a user, I want to see placeholder content while articles are loading, so that the app feels responsive and fast.

#### Acceptance Criteria

1. WHILE the Feed_Screen is loading the first page of articles, THE Mobile_App SHALL display 3 Skeleton_Loader cards mimicking the Feed_Card layout
2. WHILE the Search_Screen is loading search results, THE Mobile_App SHALL display Skeleton_Loader cards
3. WHILE the Article_Detail_View is loading article data, THE Mobile_App SHALL display a Skeleton_Loader matching the detail layout
4. WHEN content finishes loading, THE Mobile_App SHALL transition from Skeleton_Loader to actual content with a fade animation within 200ms

### Requirement 10: Error States and Offline Handling

**User Story:** As a user, I want clear feedback when something goes wrong, so that I know what happened and can retry.

#### Acceptance Criteria

1. IF a network request fails on the Feed_Screen, THEN THE Mobile_App SHALL display the Error_State_View with an error message and a "Thử lại" (retry) button
2. IF a network request fails on the Bookmarks screen, THEN THE Mobile_App SHALL display the Error_State_View with a retry button
3. WHEN the user taps the retry button on any Error_State_View, THE Mobile_App SHALL re-attempt the failed request
4. IF the device has no internet connection, THEN THE Mobile_App SHALL display a banner message "Không có kết nối mạng" at the top of the screen
5. THE Mobile_App SHALL cache the last successfully loaded feed page locally so users can view previously loaded content while offline

### Requirement 11: Screen Transitions and Micro-Interactions

**User Story:** As a user, I want smooth animations and tactile feedback, so that the app feels responsive and delightful.

#### Acceptance Criteria

1. WHEN the user navigates between bottom navigation tabs, THE Mobile_App SHALL animate the transition with a cross-fade effect within 250ms
2. WHEN the user bookmarks an article, THE Mobile_App SHALL trigger Haptic_Feedback (light impact) and animate the bookmark icon with a scale bounce effect
3. WHEN the user performs a pull-to-refresh gesture, THE Mobile_App SHALL trigger Haptic_Feedback (medium impact) at the refresh threshold
4. WHEN the user taps a Feed_Card, THE Mobile_App SHALL apply a subtle press-down scale animation (0.98x) before navigating

### Requirement 12: Expanded Topic Categories

**User Story:** As a user, I want more topic categories to choose from, so that I can follow a wider range of interests.

#### Acceptance Criteria

1. THE Backend_API SHALL support at least 8 topic categories: AI, Finance, Lifestyle, Drama, Technology, Career, Health, Entertainment
2. THE Topic_Chip component SHALL dynamically render all available topics fetched from the Backend_API instead of a hardcoded list
3. WHEN a new topic is added to the Backend_API, THE Mobile_App SHALL display the new Topic_Chip without requiring an app update
4. THE Onboarding_Flow topic selection screen SHALL display all available topics from the Backend_API

### Requirement 13: Reading History

**User Story:** As a user, I want to see articles I have previously read, so that I can revisit content I found interesting.

#### Acceptance Criteria

1. THE Backend_API SHALL provide a reading history endpoint that returns articles the user has viewed, ordered by most recent view date
2. THE Mobile_App SHALL display a Reading_History_Screen accessible from the profile section
3. THE Reading_History_Screen SHALL support pagination using infinite scroll
4. WHEN the user taps an article in the Reading_History_Screen, THE Mobile_App SHALL navigate to the Article_Detail_View

### Requirement 14: Push Notifications for Trending Content

**User Story:** As a user, I want to receive notifications about trending news, so that I stay engaged and do not miss important stories.

#### Acceptance Criteria

1. WHEN the Mobile_App launches for the first time, THE Notification_Service SHALL request push notification permission from the user
2. WHEN an article reaches the top 3 trending articles within a 6-hour window, THE Notification_Service SHALL send a push notification to users who have the article's topic in their interests
3. THE Notification_Service SHALL send a maximum of 3 push notifications per user per day
4. WHEN the user taps a push notification, THE Mobile_App SHALL open and navigate to the Article_Detail_View for the referenced article
5. THE Mobile_App SHALL provide a notification settings toggle in the profile screen to enable or disable push notifications

### Requirement 15: Enhanced Profile Screen

**User Story:** As a user, I want a richer profile experience with my activity stats, so that I feel engaged and can manage my preferences.

#### Acceptance Criteria

1. THE Profile screen SHALL display the user's reading statistics: total articles read, total bookmarks, and days active
2. THE Profile screen SHALL provide access to the Reading_History_Screen via a "Lịch sử đọc" menu item
3. THE Profile screen SHALL provide the Dark_Mode_Toggle setting
4. THE Profile screen SHALL provide the notification settings toggle
5. THE Profile screen SHALL display the current app version number
