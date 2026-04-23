import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="terms-page">
      <header class="terms-header">
        <a routerLink="/" class="back-link">← Trang chủ</a>
        <h1>Điều Khoản Sử Dụng</h1>
        <p class="subtitle">TrendBrief AI — Ứng dụng tin tức AI</p>
        <p class="effective-date">Ngày hiệu lực: 01/07/2025</p>
      </header>

      <main class="terms-content">
        <section>
          <h2>1. Chấp nhận điều khoản</h2>
          <p>
            Bằng việc truy cập hoặc sử dụng ứng dụng TrendBrief AI ("Dịch vụ"), bao gồm ứng dụng di động
            và website trendbriefai.vn, bạn đồng ý tuân thủ và chịu ràng buộc bởi các Điều khoản sử dụng này
            ("Điều khoản"). Nếu bạn không đồng ý với bất kỳ phần nào của Điều khoản, vui lòng ngừng sử dụng
            Dịch vụ ngay lập tức.
          </p>
          <p>
            Việc tiếp tục sử dụng Dịch vụ sau khi có thay đổi về Điều khoản đồng nghĩa với việc bạn
            chấp nhận các thay đổi đó.
          </p>
        </section>

        <section>
          <h2>2. Mô tả dịch vụ</h2>
          <p>TrendBrief AI là nền tảng tin tức sử dụng trí tuệ nhân tạo, cung cấp các tính năng chính sau:</p>
          <ul>
            <li>
              <strong>Tổng hợp tin tức:</strong> Thu thập tự động bài viết từ nhiều nguồn tin uy tín
              bằng tiếng Việt.
            </li>
            <li>
              <strong>Tóm tắt bằng AI:</strong> Sử dụng mô hình ngôn ngữ để tạo bản tóm tắt ngắn gọn,
              dễ hiểu cho mỗi bài viết.
            </li>
            <li>
              <strong>Phân loại chủ đề:</strong> Tự động phân loại bài viết theo các chủ đề như Công nghệ,
              Tài chính, Sức khỏe, Giải trí, Thể thao, v.v.
            </li>
            <li>
              <strong>Cá nhân hóa:</strong> Đề xuất nội dung phù hợp dựa trên chủ đề quan tâm và
              lịch sử đọc của bạn.
            </li>
            <li>
              <strong>Thông báo đẩy:</strong> Gửi cập nhật về tin tức nổi bật và bản tin định kỳ.
            </li>
          </ul>
        </section>

        <section>
          <h2>3. Tài khoản người dùng</h2>
          <p>Khi tạo tài khoản trên TrendBrief AI, bạn có trách nhiệm:</p>
          <ul>
            <li>Cung cấp thông tin chính xác và cập nhật khi đăng ký.</li>
            <li>Bảo mật thông tin đăng nhập và không chia sẻ tài khoản cho người khác.</li>
            <li>Thông báo cho chúng tôi ngay khi phát hiện truy cập trái phép vào tài khoản.</li>
            <li>Chịu trách nhiệm cho mọi hoạt động diễn ra dưới tài khoản của bạn.</li>
          </ul>
          <p>
            Bạn phải từ 13 tuổi trở lên để sử dụng Dịch vụ. Chúng tôi có quyền từ chối cung cấp
            dịch vụ hoặc đóng tài khoản nếu phát hiện vi phạm điều kiện này.
          </p>
        </section>

        <section>
          <h2>4. Quy tắc sử dụng</h2>
          <p>Khi sử dụng TrendBrief AI, bạn cam kết không thực hiện các hành vi sau:</p>
          <ul>
            <li>Sử dụng Dịch vụ cho mục đích bất hợp pháp hoặc vi phạm pháp luật Việt Nam.</li>
            <li>Cố gắng truy cập trái phép vào hệ thống, máy chủ, hoặc dữ liệu của Dịch vụ.</li>
            <li>
              Sử dụng bot, crawler, hoặc công cụ tự động để thu thập dữ liệu từ Dịch vụ
              mà không có sự cho phép bằng văn bản.
            </li>
            <li>Phát tán mã độc, virus, hoặc bất kỳ phần mềm gây hại nào thông qua Dịch vụ.</li>
            <li>Giả mạo danh tính hoặc mạo nhận là người khác.</li>
            <li>Can thiệp hoặc làm gián đoạn hoạt động bình thường của Dịch vụ.</li>
            <li>Sao chép, phân phối, hoặc sử dụng nội dung từ Dịch vụ cho mục đích thương mại
              mà không có sự đồng ý của chúng tôi.</li>
          </ul>
        </section>

        <section>
          <h2>5. Sở hữu trí tuệ</h2>
          <p>
            Nội dung trên TrendBrief AI bao gồm nhiều loại tài sản trí tuệ khác nhau. Bạn cần lưu ý:
          </p>
          <ul>
            <li>
              <strong>Nội dung gốc:</strong> Bài viết gốc thuộc quyền sở hữu của các nguồn tin
              (báo chí, trang web) đã xuất bản chúng. TrendBrief AI không tuyên bố quyền sở hữu
              đối với nội dung gốc.
            </li>
            <li>
              <strong>Bản tóm tắt AI:</strong> Các bản tóm tắt do AI tạo ra là nội dung phái sinh
              (derivative content). Chúng được tạo tự động nhằm mục đích cung cấp thông tin tóm lược
              và không thay thế bài viết gốc.
            </li>
            <li>
              <strong>Thương hiệu:</strong> Tên "TrendBrief AI", logo, giao diện, và thiết kế ứng dụng
              là tài sản trí tuệ của chúng tôi.
            </li>
            <li>
              <strong>Phần mềm:</strong> Mã nguồn, thuật toán, và công nghệ AI của TrendBrief AI
              thuộc quyền sở hữu của chúng tôi và được bảo vệ bởi luật sở hữu trí tuệ.
            </li>
          </ul>
          <p>
            Bạn được phép chia sẻ liên kết bài viết cho mục đích cá nhân, phi thương mại.
            Mọi hình thức sao chép hoặc phân phối khác cần có sự đồng ý bằng văn bản.
          </p>
        </section>

        <section>
          <h2>6. Giới hạn trách nhiệm</h2>
          <p>
            TrendBrief AI cung cấp Dịch vụ trên cơ sở "nguyên trạng" (as-is) và "sẵn có" (as-available).
            Chúng tôi không đảm bảo rằng:
          </p>
          <ul>
            <li>Dịch vụ sẽ hoạt động liên tục, không bị gián đoạn hoặc không có lỗi.</li>
            <li>Bản tóm tắt AI luôn chính xác 100% so với nội dung gốc.</li>
            <li>Thông tin trên Dịch vụ luôn đầy đủ, cập nhật, hoặc phù hợp cho mọi mục đích.</li>
          </ul>
          <p>
            Trong phạm vi tối đa được pháp luật cho phép, TrendBrief AI không chịu trách nhiệm về
            bất kỳ thiệt hại trực tiếp, gián tiếp, ngẫu nhiên, đặc biệt, hoặc hậu quả nào phát sinh
            từ việc sử dụng hoặc không thể sử dụng Dịch vụ, bao gồm nhưng không giới hạn:
          </p>
          <ul>
            <li>Mất dữ liệu hoặc thông tin.</li>
            <li>Quyết định dựa trên nội dung tóm tắt AI.</li>
            <li>Gián đoạn kinh doanh hoặc mất lợi nhuận.</li>
            <li>Truy cập trái phép vào dữ liệu cá nhân do lỗi bảo mật ngoài tầm kiểm soát.</li>
          </ul>
        </section>

        <section>
          <h2>7. Tính khả dụng của dịch vụ</h2>
          <p>
            Chúng tôi nỗ lực duy trì Dịch vụ hoạt động ổn định, tuy nhiên không cam kết thời gian
            hoạt động 100% (uptime). Dịch vụ có thể tạm ngừng hoặc gián đoạn do:
          </p>
          <ul>
            <li>Bảo trì hệ thống định kỳ hoặc khẩn cấp.</li>
            <li>Cập nhật phần mềm và tính năng mới.</li>
            <li>Sự cố kỹ thuật từ nhà cung cấp hạ tầng.</li>
            <li>Sự kiện bất khả kháng (thiên tai, mất điện diện rộng, tấn công mạng).</li>
          </ul>
          <p>
            Chúng tôi sẽ cố gắng thông báo trước khi bảo trì theo kế hoạch và khắc phục sự cố
            trong thời gian sớm nhất có thể.
          </p>
        </section>

        <section>
          <h2>8. Chấm dứt</h2>
          <p>
            Chúng tôi có quyền tạm ngưng hoặc chấm dứt quyền truy cập của bạn vào Dịch vụ
            mà không cần thông báo trước nếu:
          </p>
          <ul>
            <li>Bạn vi phạm bất kỳ điều khoản nào trong Điều khoản này.</li>
            <li>Bạn sử dụng Dịch vụ cho mục đích bất hợp pháp.</li>
            <li>Tài khoản của bạn bị nghi ngờ có hoạt động gian lận hoặc lạm dụng.</li>
          </ul>
          <p>
            Bạn có thể chấm dứt tài khoản bất kỳ lúc nào bằng cách liên hệ với chúng tôi qua email.
            Sau khi chấm dứt, dữ liệu cá nhân của bạn sẽ được xử lý theo
            <a routerLink="/privacy">Chính sách bảo mật</a>.
          </p>
        </section>

        <section>
          <h2>9. Thay đổi điều khoản</h2>
          <p>
            Chúng tôi có quyền sửa đổi hoặc cập nhật Điều khoản này vào bất kỳ lúc nào.
            Khi có thay đổi quan trọng, chúng tôi sẽ:
          </p>
          <ul>
            <li>Cập nhật ngày hiệu lực ở đầu trang.</li>
            <li>Gửi thông báo qua ứng dụng hoặc email cho người dùng đã đăng ký.</li>
            <li>Hiển thị thông báo trên website trong thời gian hợp lý.</li>
          </ul>
          <p>
            Phiên bản mới nhất của Điều khoản luôn có sẵn tại trang này. Việc tiếp tục sử dụng
            Dịch vụ sau khi thay đổi có hiệu lực đồng nghĩa với việc bạn chấp nhận Điều khoản mới.
          </p>
        </section>

        <section>
          <h2>10. Luật áp dụng</h2>
          <p>
            Điều khoản này được điều chỉnh và giải thích theo pháp luật nước Cộng hòa Xã hội
            Chủ nghĩa Việt Nam. Mọi tranh chấp phát sinh từ hoặc liên quan đến Điều khoản này
            sẽ được giải quyết tại tòa án có thẩm quyền tại Việt Nam.
          </p>
          <p>
            Trong trường hợp bất kỳ điều khoản nào bị coi là không hợp lệ hoặc không thể thi hành,
            các điều khoản còn lại vẫn giữ nguyên hiệu lực.
          </p>
        </section>

        <section>
          <h2>11. Liên hệ</h2>
          <p>
            Nếu bạn có câu hỏi hoặc góp ý về Điều khoản sử dụng này, vui lòng liên hệ:
          </p>
          <ul>
            <li><strong>Email:</strong> support&#64;trendbriefai.vn</li>
            <li><strong>Website:</strong> trendbriefai.vn</li>
          </ul>
          <p>Chúng tôi sẽ phản hồi trong vòng 7 ngày làm việc.</p>
        </section>
      </main>

      <footer class="terms-footer">
        <p>&copy; 2025 TrendBrief AI. Mọi quyền được bảo lưu.</p>
        <div class="footer-links">
          <a routerLink="/privacy">Chính sách bảo mật</a>
          <a routerLink="/">Trang chủ</a>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    .terms-page {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #1e293b;
      line-height: 1.7;
    }

    .terms-header {
      text-align: center;
      margin-bottom: 3rem;
      padding-bottom: 2rem;
      border-bottom: 1px solid #e2e8f0;
    }

    .back-link {
      display: inline-block;
      margin-bottom: 1rem;
      color: #6366f1;
      text-decoration: none;
      font-size: 0.9rem;
    }

    .back-link:hover {
      text-decoration: underline;
    }

    h1 {
      font-size: 2rem;
      font-weight: 700;
      margin: 0 0 0.5rem;
      color: #0f172a;
    }

    .subtitle {
      color: #64748b;
      margin: 0 0 0.25rem;
    }

    .effective-date {
      color: #94a3b8;
      font-size: 0.875rem;
      margin: 0;
    }

    .terms-content section {
      margin-bottom: 2rem;
    }

    h2 {
      font-size: 1.25rem;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 0.75rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #f1f5f9;
    }

    h3 {
      font-size: 1rem;
      font-weight: 600;
      color: #334155;
      margin: 1rem 0 0.5rem;
    }

    p {
      margin: 0 0 0.75rem;
    }

    ul {
      margin: 0 0 0.75rem;
      padding-left: 1.5rem;
    }

    li {
      margin-bottom: 0.4rem;
    }

    a {
      color: #6366f1;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    .terms-footer {
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      color: #94a3b8;
      font-size: 0.875rem;
    }

    .footer-links {
      display: flex;
      justify-content: center;
      gap: 1.5rem;
      margin-top: 0.5rem;
    }

    .footer-links a {
      color: #6366f1;
      font-size: 0.875rem;
    }

    @media (max-width: 640px) {
      .terms-page {
        padding: 1rem;
      }

      h1 {
        font-size: 1.5rem;
      }
    }
  `],
})
export class TermsComponent {}
