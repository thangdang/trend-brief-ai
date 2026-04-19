import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

class SkeletonDetailView extends StatelessWidget {
  const SkeletonDetailView({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final baseColor = isDark ? Colors.grey[800]! : Colors.grey[300]!;
    final highlightColor = isDark ? Colors.grey[700]! : Colors.grey[100]!;

    return Shimmer.fromColors(
      baseColor: baseColor,
      highlightColor: highlightColor,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Topic badge + source
            Row(children: [
              Container(width: 60, height: 20, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10))),
              const SizedBox(width: 8),
              Container(width: 100, height: 14, color: Colors.white),
            ]),
            const SizedBox(height: 16),
            // Title
            Container(width: double.infinity, height: 22, color: Colors.white),
            const SizedBox(height: 8),
            Container(width: 250, height: 22, color: Colors.white),
            const SizedBox(height: 16),
            // Date + reading time
            Container(width: 180, height: 14, color: Colors.white),
            const SizedBox(height: 24),
            // Bullets
            for (int i = 0; i < 3; i++) ...[
              Container(width: double.infinity, height: 14, color: Colors.white),
              const SizedBox(height: 6),
              Container(width: 280, height: 14, color: Colors.white),
              const SizedBox(height: 16),
            ],
            // Reason box
            Container(
              width: double.infinity,
              height: 60,
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8)),
            ),
          ],
        ),
      ),
    );
  }
}
