class ApiConfig {
  static const String baseUrl = 'http://10.0.2.2:3000/api';
  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 15);
  static const int defaultPageSize = 20;
  static const int maxPageSize = 50;
}
