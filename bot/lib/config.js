const PAGE_NAME = 'Linkosys';

// URL Trang (Page) để bot đăng thẳng lên tường Page (tư cách Page, dùng cookie).
const PAGE_URL = 'https://web.facebook.com/Linkosys.It/';

// Danh sách NHÓM (chỉ để các URL /groups/... — KHÔNG để URL Page ở đây,
// vì Page có giao diện soạn thảo khác, sẽ khiến bot treo khi tìm ô "Viết gì đó").
const GROUPS = [
  'https://www.facebook.com/groups/comailo',
  'https://www.facebook.com/groups/groupaivietnam/',
  'https://www.facebook.com/groups/openclawxvn/',
  'https://www.facebook.com/groups/861108920047086/'
];

const FB_API_VERSION = 'v21.0';

module.exports = { PAGE_NAME, PAGE_URL, GROUPS, FB_API_VERSION };
