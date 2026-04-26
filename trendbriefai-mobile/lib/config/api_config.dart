class ApiConfig {
  static const String baseUrl = 'http://10.0.2.2:3000/api';
  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 15);
  static const int defaultPageSize = 20;
  static const int maxPageSize = 50;

  // Auth endpoints
  static const String login = '/auth/login';
  static const String register = '/auth/register';
  static const String googleAuth = '/auth/google';
  static const String appleAuth = '/auth/apple';
  static const String refresh = '/auth/refresh';

  // Payment endpoints
  static const String paymentPlans = '/payment/plans';
  static const String paymentCreate = '/payment/create';
  static const String paymentVerifyMobile = '/payment/verify-mobile';
  static const String paymentSubscription = '/payment/subscription';
  static const String paymentCancel = '/payment/cancel';
}
