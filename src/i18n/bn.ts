// Every public UI string lives here, so an English version can be added later as i18n/en.ts.
// Numbers passed in are already formatted (Bangla digits) by src/lib/format.ts.

export const bn = {
  siteName: "টেস্টদাম",
  tagline: "ঢাকার ল্যাবগুলোতে টেস্টের দাম তুলনা করুন",
  home: "হোম",
  skipToContent: "মূল অংশে যান",

  // Search
  searchLabel: "টেস্টের নাম লিখুন",
  searchPlaceholder: "যেমন: CBC, সিবিসি, লিপিড প্রোফাইল, ডেঙ্গু",
  searchButton: "খুঁজুন",
  searchNoResults: (q: string) => `“${q}” নামে কোনো টেস্ট পাওয়া যায়নি`,
  searchNoResultsHint: "বানান বদলে বা ইংরেজি নাম (যেমন CBC) লিখে আবার চেষ্টা করুন।",
  searchResultsTitle: (q: string) => `“${q}” এর ফলাফল`,
  searchFrom: (price: string) => `${price} থেকে`,
  searchInArea: (area: string) => `${area} এলাকার ল্যাব ও টেস্টের দাম`,

  // Home
  homeHeading: "কোন টেস্টের দাম জানতে চান?",
  homeIntro: "একই টেস্টের দাম ল্যাবভেদে অনেক আলাদা হয়। দাম, রিপোর্টের সময় ও হোম কালেকশন মিলিয়ে দেখুন।",
  popularTests: "জনপ্রিয় টেস্ট",
  areasHeading: "এলাকা অনুযায়ী ল্যাব",
  labsCount: (n: string) => `${n}টি ল্যাব`,

  // Price pages
  testPriceTitle: (test: string) => `${test} টেস্টের দাম`,
  testPriceInArea: (test: string, area: string) => `${area} এলাকায় ${test} টেস্টের দাম`,
  priceRange: "দামের পরিসর",
  labsWithFreshPrice: (n: string) => `${n}টি ল্যাবে যাচাই করা দাম`,
  sampleType: "নমুনা",
  disclaimer: "দাম যেকোনো সময় বদলাতে পারে। টেস্ট করানোর আগে ল্যাবে ফোন করে দাম নিশ্চিত হয়ে নিন।",
  preparation: "প্রস্তুতি",
  aboutTest: "টেস্ট সম্পর্কে",

  cheapest: "সবচেয়ে কম দাম",
  featured: "ফিচার্ড",
  featuredNote: "ফিচার্ড ল্যাব দামের ক্রমে আগে আসে না।",
  regularPrice: "নিয়মিত দাম",
  offerUntil: (d: string) => `অফার ${d} পর্যন্ত`,
  offer: "অফার",
  report: "রিপোর্ট",
  homeCollection: "হোম কালেকশন",
  homeCollectionYes: "বাসা থেকে নমুনা নেয়",
  homeCollectionNo: "বাসা থেকে নমুনা নেয় না",
  homeCollectionFee: (fee: string) => `ফি ${fee}`,
  homeCollectionFree: "ফি নেই",
  verified: (d: string) => `যাচাই: ${d}`,
  stale: "পুরনো তথ্য — ল্যাবে ফোন করে নিশ্চিত হোন",
  staleGroup: (n: string) => `পুরনো দাম (${n}টি) — ৯০ দিনের বেশি আগে যাচাই করা`,
  call: "কল করুন",
  whatsapp: "হোয়াটসঅ্যাপ",
  directions: "ম্যাপে দেখুন",

  sources: {
    PHONE_CALL: "ফোনে নিশ্চিত",
    PRICE_LIST: "ল্যাবের মূল্যতালিকা",
    WEBSITE: "ল্যাবের ওয়েবসাইট",
    LAB_SUBMITTED: "ল্যাব থেকে প্রাপ্ত",
    VISIT: "সরাসরি গিয়ে দেখা",
  } as Record<string, string>,

  // Filters
  filters: "ফিল্টার",
  filterArea: "এলাকা",
  filterAllAreas: "সব এলাকা",
  filterHome: "শুধু হোম কালেকশন",
  filterReport: "রিপোর্ট",
  filterReportAny: "যেকোনো সময়",
  filterReport24: "২৪ ঘণ্টার মধ্যে",
  filterReport48: "৪৮ ঘণ্টার মধ্যে",
  filterShowing: (shown: string, total: string) => `${total}টির মধ্যে ${shown}টি ল্যাব দেখানো হচ্ছে`,
  filterNone: "এই ফিল্টারে কোনো ল্যাব নেই।",

  // Internal links
  byArea: "এলাকা অনুযায়ী দাম",
  nearbyAreas: "আশেপাশের এলাকায় একই টেস্ট",
  nearbyAreaLinks: "আশেপাশের এলাকা",
  allDhaka: (test: string) => `সারা ঢাকায় ${test} এর দাম`,
  otherTests: "অন্যান্য টেস্ট",

  // Lab page
  labTests: "এই ল্যাবের টেস্টের দাম",
  address: "ঠিকানা",
  phone: "ফোন",
  openingHours: "খোলার সময়",
  lastUpdated: (d: string) => `সর্বশেষ আপডেট: ${d}`,
  labsInArea: (area: string) => `${area} এলাকার আরও ল্যাব`,

  // Area page
  areaTitle: (area: string) => `${area} এলাকার ডায়াগনস্টিক ল্যাব ও টেস্টের দাম`,
  areaLabs: "এই এলাকার ল্যাব",
  areaTests: "এই এলাকায় টেস্টের দাম",
  freshPrices: (n: string) => `${n}টি টেস্টের দাম`,

  // 404
  notFoundTitle: "পাতাটি পাওয়া যায়নি",
  notFoundBody: "এই পাতায় দেখানোর মতো যথেষ্ট যাচাই করা দাম এখনো নেই, অথবা ঠিকানাটি ভুল।",
  backHome: "হোমে ফিরে যান",

  footerNote: "টেস্টদাম কোনো ল্যাব নয়। দামগুলো আমরা ল্যাব থেকে সংগ্রহ করে যাচাইয়ের তারিখসহ দেখাই।",
} as const;
