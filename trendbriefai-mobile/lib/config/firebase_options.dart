import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

/// Default Firebase configuration options for each platform.
///
/// TODO: Replace these placeholder values with your real Firebase project credentials.
/// You can generate this file automatically using the FlutterFire CLI:
///   dart pub global activate flutterfire_cli
///   flutterfire configure
///
/// Alternatively, copy values from your Firebase Console project settings.
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not supported for this platform.',
        );
    }
  }

  // TODO: Replace with real Android Firebase options from Firebase Console
  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'TODO_ANDROID_API_KEY',
    appId: '1:TODO_PROJECT_NUMBER:android:TODO_APP_HASH',
    messagingSenderId: 'TODO_PROJECT_NUMBER',
    projectId: 'TODO_PROJECT_ID',
    storageBucket: 'TODO_PROJECT_ID.appspot.com',
  );

  // TODO: Replace with real iOS Firebase options from Firebase Console
  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'TODO_IOS_API_KEY',
    appId: '1:TODO_PROJECT_NUMBER:ios:TODO_APP_HASH',
    messagingSenderId: 'TODO_PROJECT_NUMBER',
    projectId: 'TODO_PROJECT_ID',
    storageBucket: 'TODO_PROJECT_ID.appspot.com',
    iosBundleId: 'com.trendbriefai.app',
  );

  // TODO: Replace with real Web Firebase options from Firebase Console
  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'TODO_WEB_API_KEY',
    appId: '1:TODO_PROJECT_NUMBER:web:TODO_APP_HASH',
    messagingSenderId: 'TODO_PROJECT_NUMBER',
    projectId: 'TODO_PROJECT_ID',
    storageBucket: 'TODO_PROJECT_ID.appspot.com',
    authDomain: 'TODO_PROJECT_ID.firebaseapp.com',
  );
}
