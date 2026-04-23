import 'package:flutter/material.dart';

/// Premium subscription UI — paywall + feature comparison (Task 33.2)
class PremiumScreen extends StatelessWidget {
  const PremiumScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Premium')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            const Icon(Icons.workspace_premium, size: 64, color: Colors.amber),
            const SizedBox(height: 16),
            Text('TrendBrief AI Premium', style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text('Trải nghiệm đọc tin tốt nhất', style: theme.textTheme.bodyLarge?.copyWith(color: Colors.grey)),
            const SizedBox(height: 32),

            // Feature comparison
            _FeatureRow(feature: 'Đọc tin AI tóm tắt', free: true, premium: true),
            _FeatureRow(feature: 'Không quảng cáo', free: false, premium: true),
            _FeatureRow(feature: 'AI không giới hạn', free: false, premium: true),
            _FeatureRow(feature: 'Chủ đề "Insight" độc quyền', free: false, premium: true),
            _FeatureRow(feature: 'Tóm tắt URL bất kỳ', free: false, premium: true),
            _FeatureRow(feature: 'Briefing audio hàng ngày', free: false, premium: true),

            const SizedBox(height: 32),

            // Pricing
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [Color(0xFF6366f1), Color(0xFF818cf8)]),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(children: [
                const Text('49.000đ / tháng', style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Colors.white)),
                const SizedBox(height: 4),
                const Text('hoặc 399.000đ / năm (tiết kiệm 32%)', style: TextStyle(color: Colors.white70)),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () {
                    // Task 33.3: Payment integration (Momo + VNPay)
                    _showPaymentOptions(context);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: const Color(0xFF6366f1),
                    padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 14),
                  ),
                  child: const Text('Đăng ký Premium', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ]),
            ),
          ],
        ),
      ),
    );
  }

  void _showPaymentOptions(BuildContext context) {
    showModalBottomSheet(
      context: context,
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('Chọn phương thức thanh toán', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          ListTile(
            leading: const Icon(Icons.account_balance_wallet, color: Color(0xFFa50064)),
            title: const Text('MoMo'),
            subtitle: const Text('Thanh toán qua ví MoMo'),
            onTap: () { Navigator.pop(ctx); /* TODO: Momo deep link */ },
          ),
          ListTile(
            leading: const Icon(Icons.payment, color: Color(0xFF005baa)),
            title: const Text('VNPay'),
            subtitle: const Text('Thanh toán qua VNPay'),
            onTap: () { Navigator.pop(ctx); /* TODO: VNPay integration */ },
          ),
        ]),
      ),
    );
  }
}

class _FeatureRow extends StatelessWidget {
  final String feature;
  final bool free;
  final bool premium;

  const _FeatureRow({required this.feature, required this.free, required this.premium});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(children: [
        Expanded(flex: 3, child: Text(feature)),
        Expanded(child: Center(child: Icon(free ? Icons.check_circle : Icons.cancel, color: free ? Colors.green : Colors.grey[300], size: 20))),
        Expanded(child: Center(child: Icon(premium ? Icons.check_circle : Icons.cancel, color: premium ? Colors.green : Colors.grey[300], size: 20))),
      ]),
    );
  }
}
