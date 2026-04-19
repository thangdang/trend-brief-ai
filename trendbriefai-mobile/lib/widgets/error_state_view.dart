import 'package:flutter/material.dart';

class ErrorStateView extends StatelessWidget {
  final String message;
  final VoidCallback? onRetry;
  final bool showOfflineBanner;

  const ErrorStateView({
    super.key,
    this.message = 'Đã xảy ra lỗi',
    this.onRetry,
    this.showOfflineBanner = false,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (showOfflineBanner)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 16),
            color: Colors.red.shade700,
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.wifi_off, color: Colors.white, size: 16),
                SizedBox(width: 8),
                Text('Không có kết nối mạng', style: TextStyle(color: Colors.white, fontSize: 13)),
              ],
            ),
          ),
        Expanded(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.error_outline, size: 64, color: Colors.grey[400]),
                  const SizedBox(height: 16),
                  Text(message, style: Theme.of(context).textTheme.bodyLarge, textAlign: TextAlign.center),
                  if (onRetry != null) ...[
                    const SizedBox(height: 16),
                    FilledButton.icon(
                      onPressed: onRetry,
                      icon: const Icon(Icons.refresh),
                      label: const Text('Thử lại'),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}
