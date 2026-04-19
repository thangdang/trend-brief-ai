// ═══════════════════════════════════════════
//  MongoDB — Seed RSS Sources
//  TrendBrief AI — ALL sources from spec/resources.json
//  Each URL mapped to RSS feed or HTML scrape config
//  Run: mongosh trendbriefai 002_seed_rss_sources.js
// ═══════════════════════════════════════════

db = db.getSiblingDB('trendbriefai');

const now = new Date();

// ─── Known RSS feed patterns for VN news sites ───
// Most VN news sites follow: domain/rss/{section-slug}.rss
// or domain/rss/home.rss for homepage

const sources = [

  // ═══════════════════════════════════════
  //  AI (22 sources)
  // ═══════════════════════════════════════
  { name: 'VnExpress Khoa học',        url: 'https://vnexpress.net/rss/khoa-hoc.rss',          category: 'ai', source_type: 'rss', crawl_interval_minutes: NumberInt(15) },
  { name: 'VnExpress Số hóa',          url: 'https://vnexpress.net/rss/so-hoa.rss',            category: 'ai', source_type: 'rss', crawl_interval_minutes: NumberInt(15) },
  { name: 'VnEconomy Công nghệ',       url: 'https://vneconomy.vn/rss/cong-nghe.rss',         category: 'ai', source_type: 'rss', crawl_interval_minutes: NumberInt(15) },
  { name: 'ICT News',                  url: 'https://ictnews.vietnamnet.vn/rss/home.rss',      category: 'ai', source_type: 'rss', crawl_interval_minutes: NumberInt(15) },
  { name: 'Genk AI',                   url: 'https://genk.vn/ai',                              category: 'ai', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(30), scrape_link_selector: 'h3.knswli-title a', scrape_content_selector: 'div.knc-content' },
  { name: 'Tinhte AI',                 url: 'https://tinhte.vn/tags/ai',                       category: 'ai', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(30), scrape_link_selector: 'a.thread-title', scrape_content_selector: 'article.message-body' },
  { name: 'Dân Trí Công nghệ',         url: 'https://dantri.com.vn/rss/cong-nghe.rss',        category: 'ai', source_type: 'rss', crawl_interval_minutes: NumberInt(15) },
  { name: 'Thanh Niên Công nghệ',      url: 'https://thanhnien.vn/rss/cong-nghe.rss',         category: 'ai', source_type: 'rss', crawl_interval_minutes: NumberInt(15) },
  { name: 'Tuổi Trẻ Công nghệ',        url: 'https://tuoitre.vn/rss/nhip-song-so.rss',       category: 'ai', source_type: 'rss', crawl_interval_minutes: NumberInt(15) },
  { name: 'Báo Mới AI',                url: 'https://baomoi.com/tag/ai.epi',                   category: 'ai', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(30), scrape_link_selector: 'h4.bm_S a', scrape_content_selector: 'div.bm_F' },
  { name: 'VietnamNet Công nghệ',      url: 'https://vietnamnet.vn/rss/cong-nghe.rss',        category: 'ai', source_type: 'rss', crawl_interval_minutes: NumberInt(15) },
  { name: 'CafeBiz Công nghệ',         url: 'https://cafebiz.vn/cong-nghe',                   category: 'ai', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(30), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.detail-content' },
  { name: 'VietTimes Công nghệ',       url: 'https://viettimes.vn/cong-nghe',                 category: 'ai', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(30), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.article-content' },
  { name: 'VnReview',                  url: 'https://vnreview.vn',                             category: 'ai', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(30), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.article-body' },
  { name: 'Nhịp Sống Số',             url: 'https://nhipsongso.tuoitre.vn',                   category: 'ai', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(30), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.detail-content' },
  { name: 'Doanh Nghiệp VN Công nghệ', url: 'https://doanhnghiepvn.vn/cong-nghe',            category: 'ai', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(60), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.article-content' },
  { name: 'Tạp Chí Công Thương CN',    url: 'https://tapchicongthuong.vn/cong-nghe',          category: 'ai', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(60), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.article-content' },
  { name: 'VOV Công nghệ',             url: 'https://vov.vn/rss/cong-nghe.rss',               category: 'ai', source_type: 'rss', crawl_interval_minutes: NumberInt(15) },
  { name: 'VOV Giao thông CN',         url: 'https://vovgiaothong.vn/cong-nghe',              category: 'ai', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(60), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.article-content' },
  { name: 'Báo Đầu Tư Công nghệ',     url: 'https://baodautu.vn/cong-nghe',                  category: 'ai', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(60), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.article-content' },
  { name: 'Tổ Quốc Công nghệ',        url: 'https://ttvn.toquoc.vn/cong-nghe',               category: 'ai', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(60), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.article-content' },
  { name: 'VietnamPlus Công nghệ',     url: 'https://vietnamplus.vn/rss/cong-nghe.rss',       category: 'ai', source_type: 'rss', crawl_interval_minutes: NumberInt(15) },

  // ═══════════════════════════════════════
  //  FINANCE (24 sources)
  // ═══════════════════════════════════════
  { name: 'CafeF',                     url: 'https://cafef.vn/rss/home.rss',                   category: 'finance', source_type: 'rss', crawl_interval_minutes: NumberInt(10) },
  { name: 'Vietstock',                 url: 'https://vietstock.vn',                            category: 'finance', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(15), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.article-content' },
  { name: 'VnEconomy',                 url: 'https://vneconomy.vn/rss/home.rss',               category: 'finance', source_type: 'rss', crawl_interval_minutes: NumberInt(15) },
  { name: 'VnExpress Kinh doanh',      url: 'https://vnexpress.net/rss/kinh-doanh.rss',       category: 'finance', source_type: 'rss', crawl_interval_minutes: NumberInt(15) },
  { name: 'Tuổi Trẻ Kinh doanh',       url: 'https://tuoitre.vn/rss/kinh-doanh.rss',         category: 'finance', source_type: 'rss', crawl_interval_minutes: NumberInt(15) },
  { name: 'Thanh Niên Kinh tế',        url: 'https://thanhnien.vn/rss/kinh-te.rss',           category: 'finance', source_type: 'rss', crawl_interval_minutes: NumberInt(15) },
  { name: 'Dân Trí Kinh doanh',        url: 'https://dantri.com.vn/rss/kinh-doanh.rss',      category: 'finance', source_type: 'rss', crawl_interval_minutes: NumberInt(15) },
  { name: 'Báo Đầu Tư',               url: 'https://baodautu.vn/rss/home.rss',                category: 'finance', source_type: 'rss', crawl_interval_minutes: NumberInt(15) },
  { name: 'Doanh Nhân Sài Gòn',       url: 'https://doanhnhansaigon.vn',                     category: 'finance', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(30), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.article-content' },
  { name: 'Thời Báo Tài Chính VN',    url: 'https://thoibaotaichinhvietnam.vn',               category: 'finance', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(30), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.article-content' },
  { name: 'Tạp Chí Tài Chính',        url: 'https://tapchitaichinh.vn',                      category: 'finance', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(30), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.article-content' },
  { name: 'Ngân Hàng Nhà Nước',       url: 'https://sbv.gov.vn',                             category: 'finance', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(60), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.article-content' },
  { name: 'Bộ Tài Chính',             url: 'https://mof.gov.vn',                             category: 'finance', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(60), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.article-content' },
  { name: 'CafeBiz',                   url: 'https://cafebiz.vn/rss/home.rss',                category: 'finance', source_type: 'rss', crawl_interval_minutes: NumberInt(10) },
  { name: 'VietnamBiz',                url: 'https://vietnambiz.vn/rss/home.rss',             category: 'finance', source_type: 'rss', crawl_interval_minutes: NumberInt(15) },
  { name: 'VietnamNet Kinh doanh',     url: 'https://vietnamnet.vn/rss/kinh-doanh.rss',      category: 'finance', source_type: 'rss', crawl_interval_minutes: NumberInt(15) },
  { name: 'VietnamPlus Kinh tế',       url: 'https://vietnamplus.vn/rss/kinh-te.rss',        category: 'finance', source_type: 'rss', crawl_interval_minutes: NumberInt(15) },
  { name: 'Nhịp Cầu Đầu Tư',         url: 'https://nhipcaudautu.vn',                        category: 'finance', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(30), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.article-content' },
  { name: 'VnEconomy Tài chính',       url: 'https://vneconomy.vn/rss/tai-chinh.rss',        category: 'finance', source_type: 'rss', crawl_interval_minutes: NumberInt(15) },
  { name: 'Báo Mới Kinh doanh',       url: 'https://baomoi.com/kinh-doanh.epi',              category: 'finance', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(15), scrape_link_selector: 'h4.bm_S a', scrape_content_selector: 'div.bm_F' },
  { name: 'VietTimes Tài chính',       url: 'https://viettimes.vn/tai-chinh',                 category: 'finance', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(30), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.article-content' },
  { name: 'Tin Nhanh Chứng Khoán',    url: 'https://tinnhanhchungkhoan.vn',                  category: 'finance', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(15), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.article-content' },
  { name: 'StockBiz',                  url: 'https://stockbiz.vn',                            category: 'finance', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(15), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.article-content' },
  { name: 'EnterNews',                 url: 'https://enternews.vn',                           category: 'finance', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(30), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.article-content' },

  // ═══════════════════════════════════════
  //  LIFESTYLE (20 sources)
  // ═══════════════════════════════════════
  { name: 'Kenh14',                     url: 'https://kenh14.vn/rss/home.rss',                 category: 'lifestyle', source_type: 'rss', crawl_interval_minutes: NumberInt(10) },
  { name: 'VnExpress Đời sống',        url: 'https://vnexpress.net/rss/doi-song.rss',         category: 'lifestyle', source_type: 'rss', crawl_interval_minutes: NumberInt(15) },
  { name: 'Zing Đời sống',             url: 'https://zingnews.vn/doi-song.html',              category: 'lifestyle', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(15), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.the-article-body' },
  { name: 'Afamily',                   url: 'https://afamily.vn/rss/home.rss',                category: 'lifestyle', source_type: 'rss', crawl_interval_minutes: NumberInt(15) },
  { name: 'Eva',                       url: 'https://eva.vn',                                 category: 'lifestyle', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(30), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.detail-content' },
  { name: 'Soha Đời sống',             url: 'https://soha.vn/doi-song.htm',                   category: 'lifestyle', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(30), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.news-content' },
  { name: 'Thanh Niên Đời sống',       url: 'https://thanhnien.vn/rss/doi-song.rss',          category: 'lifestyle', source_type: 'rss', crawl_interval_minutes: NumberInt(15) },
  { name: 'Tuổi Trẻ Sống đẹp',        url: 'https://tuoitre.vn/rss/song-dep.rss',            category: 'lifestyle', source_type: 'rss', crawl_interval_minutes: NumberInt(15) },
  { name: 'Dân Trí Đời sống',          url: 'https://dantri.com.vn/rss/doi-song.rss',         category: 'lifestyle', source_type: 'rss', crawl_interval_minutes: NumberInt(15) },
  { name: 'Báo Mới Sống đẹp',         url: 'https://baomoi.com/song-dep.epi',                category: 'lifestyle', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(15), scrape_link_selector: 'h4.bm_S a', scrape_content_selector: 'div.bm_F' },
  { name: 'Phụ Nữ Today',             url: 'https://phunutoday.vn',                          category: 'lifestyle', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(30), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.article-content' },
  { name: 'Gia Đình Net',             url: 'https://giadinh.net.vn',                         category: 'lifestyle', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(30), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.article-content' },
  { name: 'Gia Đình Mới',             url: 'https://giadinhmoi.vn',                          category: 'lifestyle', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(30), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.article-content' },
  { name: 'Người Đưa Tin Đời sống',   url: 'https://nguoiduatin.vn/doi-song',                category: 'lifestyle', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(30), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.article-content' },
  { name: 'Đời Sống Pháp Luật',       url: 'https://doisongphapluat.com.vn',                 category: 'lifestyle', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(30), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.article-content' },
  { name: 'VOV Đời sống',              url: 'https://vov.vn/rss/doi-song.rss',                category: 'lifestyle', source_type: 'rss', crawl_interval_minutes: NumberInt(15) },
  { name: 'Lao Động Đời sống',        url: 'https://laodong.vn/rss/doi-song.rss',            category: 'lifestyle', source_type: 'rss', crawl_interval_minutes: NumberInt(15) },
  { name: 'Pháp Luật Plus Đời sống',  url: 'https://phapluatplus.vn/doi-song',               category: 'lifestyle', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(30), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.article-content' },
  { name: 'VnReview Lifestyle',        url: 'https://vnreview.vn/lifestyle',                  category: 'lifestyle', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(30), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.article-body' },
  { name: 'VietnamPlus Đời sống',      url: 'https://vietnamplus.vn/rss/doi-song.rss',        category: 'lifestyle', source_type: 'rss', crawl_interval_minutes: NumberInt(15) },

  // ═══════════════════════════════════════
  //  DRAMA (20 sources)
  // ═══════════════════════════════════════
  { name: 'Kenh14 Star',               url: 'https://kenh14.vn/rss/star.rss',                 category: 'drama', source_type: 'rss', crawl_interval_minutes: NumberInt(10) },
  { name: 'Zing Giải trí',             url: 'https://zingnews.vn/rss/giai-tri.rss',           category: 'drama', source_type: 'rss', crawl_interval_minutes: NumberInt(10) },
  { name: 'Soha Giải trí',             url: 'https://soha.vn/giai-tri.htm',                   category: 'drama', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(15), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.news-content' },
  { name: 'Afamily Giải trí',          url: 'https://afamily.vn/giai-tri.chn',                category: 'drama', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(15), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.detail-content' },
  { name: 'Eva Sao Việt',              url: 'https://eva.vn/sao-viet',                        category: 'drama', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(30), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.detail-content' },
  { name: 'Saostar',                   url: 'https://saostar.vn',                             category: 'drama', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(15), scrape_link_selector: 'h3.title a', scrape_content_selector: 'div.article-content' },
  { name: 'Yeah1',                     url: 'https://yeah1.com',                              category: 'drama', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(30), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.article-content' },
  { name: 'Báo Mới Giải trí',         url: 'https://baomoi.com/giai-tri.epi',                category: 'drama', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(15), scrape_link_selector: 'h4.bm_S a', scrape_content_selector: 'div.bm_F' },
  { name: 'Thanh Niên Giải trí',       url: 'https://thanhnien.vn/rss/giai-tri.rss',          category: 'drama', source_type: 'rss', crawl_interval_minutes: NumberInt(15) },
  { name: 'Tuổi Trẻ Giải trí',        url: 'https://tuoitre.vn/rss/giai-tri.rss',            category: 'drama', source_type: 'rss', crawl_interval_minutes: NumberInt(15) },
  { name: 'Dân Trí Giải trí',          url: 'https://dantri.com.vn/rss/giai-tri.rss',         category: 'drama', source_type: 'rss', crawl_interval_minutes: NumberInt(15) },
  { name: 'Người Đưa Tin Giải trí',   url: 'https://nguoiduatin.vn/giai-tri',                category: 'drama', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(30), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.article-content' },
  { name: 'ĐSPL Giải trí',            url: 'https://doisongphapluat.com.vn/giai-tri',        category: 'drama', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(30), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.article-content' },
  { name: 'VOV Giải trí',              url: 'https://vov.vn/rss/giai-tri.rss',                category: 'drama', source_type: 'rss', crawl_interval_minutes: NumberInt(15) },
  { name: 'Lao Động Giải trí',        url: 'https://laodong.vn/rss/giai-tri.rss',            category: 'drama', source_type: 'rss', crawl_interval_minutes: NumberInt(15) },
  { name: 'Phụ Nữ VN Văn hóa',       url: 'https://phunuvietnam.vn/van-hoa',                category: 'drama', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(30), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.article-content' },
  { name: 'VietnamPlus Giải trí',      url: 'https://vietnamplus.vn/rss/giai-tri.rss',        category: 'drama', source_type: 'rss', crawl_interval_minutes: NumberInt(15) },
  { name: 'Tiin',                      url: 'https://tiin.vn',                                category: 'drama', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(30), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.article-content' },
  { name: 'Việt Giải Trí',            url: 'https://vietgiaitri.com',                        category: 'drama', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(30), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.article-content' },
  { name: 'Thế Giới Trẻ',            url: 'https://thegioitre.vn',                          category: 'drama', source_type: 'html_scrape', crawl_interval_minutes: NumberInt(30), scrape_link_selector: 'h3 a', scrape_content_selector: 'div.article-content' },