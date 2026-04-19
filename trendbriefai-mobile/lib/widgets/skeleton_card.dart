import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

class SkeletonCard extends StatelessWidget {
  const SkeletonCard({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final baseColor = isDark ? Colors.grey[800]! : Colors.grey[300]!;
    final highlightColor = isDark ? Colors.grey[700]! : Colors.grey[100]!;

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Shimmer.fromColors(
        baseColor: baseColor,
        highlightColor: highlightColor,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Thumbnail placeholder
              Container(
                height: 160,
                width: double.infinity,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              const SizedBox(height: 12),
              // Topic + source row
              Row(children: [
                Container(width: 50, height: 14, color: Colors.white),
                const SizedBox(width: 8),
                Container(width: 80, height: 12, color: Colors.white),
              ]),
              const SizedBox(height: 10),
              // Title lines
              Container(width: double.infinity, height: 16, color: Colors.white),
              const SizedBox(height: 6),
              Container(width: 200, height: 16, color: Colors.white),
              const SizedBox(height: 12),
              // Bullet lines
              Container(width: double.infinity, height: 12, color: Colors.white),
              const SizedBox(height: 6),
              Container(width: double.infinity, height: 12, color: Colors.white),
              const SizedBox(height: 6),
              Container(width: 180, height: 12, color: Colors.white),
            ],
          ),
        ),
      ),
    );
  }
}
