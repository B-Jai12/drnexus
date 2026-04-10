import type {
  Transaction,
  TransactionCategory,
  FinancialSummary,
  Prediction,
  Recommendation,
  MerchantSpending,
  WeeklyTrend,
  User,
} from "@/types"

const categories: TransactionCategory[] = [
  "Food & Dining",
  "Shopping",
  "Transportation",
  "Entertainment",
  "Bills & Utilities",
  "Healthcare",
  "Education",
  "Travel",
  "Subscriptions",
  "Income",
]

const merchants: Record<TransactionCategory, string[]> = {
  "Food & Dining": ["Starbucks", "McDonald's", "Uber Eats", "Domino's", "Subway", "Zomato", "KFC"],
  Shopping: ["Amazon", "Flipkart", "Myntra", "Nike", "IKEA", "Walmart"],
  Transportation: ["Uber", "Ola", "Shell Gas", "Metro Card", "Lyft"],
  Entertainment: ["Netflix", "Spotify", "BookMyShow", "Steam", "Disney+"],
  "Bills & Utilities": ["Electricity Board", "Vodafone", "Water Bill", "Internet - Airtel", "Gas Bill"],
  Healthcare: ["Apollo Pharmacy", "Dr. Smith Clinic", "Lab Tests", "Gym Membership"],
  Education: ["Coursera", "Udemy", "Amazon Books", "College Fee"],
  Travel: ["MakeMyTrip", "Airbnb", "Emirates", "Booking.com"],
  Subscriptions: ["ChatGPT Plus", "GitHub Pro", "Adobe CC", "Notion"],
  Income: ["Salary - TCS", "Freelance Payment", "Investment Return", "Cashback"],
}

function randomDate(start: Date, end: Date): string {
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
  return date.toISOString().split("T")[0]
}

function generateTransactions(count: number): Transaction[] {
  const transactions: Transaction[] = []
  const startDate = new Date("2025-07-01")
  const endDate = new Date("2026-01-31")

  for (let i = 0; i < count; i++) {
    const category = categories[Math.floor(Math.random() * categories.length)]
    const merchantList = merchants[category]
    const merchant = merchantList[Math.floor(Math.random() * merchantList.length)]
    const isIncome = category === "Income"
    const type = isIncome ? "credit" : "debit"

    let amount: number
    if (isIncome) {
      amount = Math.round((Math.random() * 50000 + 10000) * 100) / 100
    } else {
      const ranges: Record<string, [number, number]> = {
        "Food & Dining": [100, 2500],
        Shopping: [500, 15000],
        Transportation: [50, 3000],
        Entertainment: [99, 1500],
        "Bills & Utilities": [200, 5000],
        Healthcare: [200, 8000],
        Education: [500, 25000],
        Travel: [2000, 50000],
        Subscriptions: [99, 2000],
      }
      const [min, max] = ranges[category] || [100, 5000]
      amount = Math.round((Math.random() * (max - min) + min) * 100) / 100
    }

    transactions.push({
      id: `txn_${String(i + 1).padStart(4, "0")}`,
      date: randomDate(startDate, endDate),
      merchant,
      category,
      amount,
      type,
      description: `${type === "credit" ? "Received from" : "Payment to"} ${merchant}`,
    })
  }

  return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export const transactions: Transaction[] = generateTransactions(220)

const totalDebit = transactions.filter((t) => t.type === "debit").reduce((sum, t) => sum + t.amount, 0)
const totalCredit = transactions.filter((t) => t.type === "credit").reduce((sum, t) => sum + t.amount, 0)

const categoryColors: Record<string, string> = {
  "Food & Dining": "hsl(160, 84%, 39%)",
  Shopping: "hsl(199, 89%, 48%)",
  Transportation: "hsl(43, 96%, 56%)",
  Entertainment: "hsl(262, 83%, 58%)",
  "Bills & Utilities": "hsl(0, 84%, 60%)",
  Healthcare: "hsl(330, 80%, 55%)",
  Education: "hsl(200, 70%, 50%)",
  Travel: "hsl(28, 90%, 55%)",
  Subscriptions: "hsl(180, 60%, 45%)",
  Income: "hsl(120, 60%, 45%)",
}

const categoryBreakdown = categories
  .filter((c) => c !== "Income")
  .map((category) => {
    const catTotal = transactions
      .filter((t) => t.category === category && t.type === "debit")
      .reduce((sum, t) => sum + t.amount, 0)
    return {
      category,
      amount: Math.round(catTotal),
      percentage: Math.round((catTotal / totalDebit) * 100),
      color: categoryColors[category],
    }
  })
  .sort((a, b) => b.amount - a.amount)

const months = ["Aug 2025", "Sep 2025", "Oct 2025", "Nov 2025", "Dec 2025", "Jan 2026"]
const monthlyExpenses = months.map((month) => ({
  month,
  debit: Math.round(Math.random() * 30000 + 20000),
  credit: Math.round(Math.random() * 60000 + 30000),
}))

export const financialSummary: FinancialSummary = {
  totalDebit: Math.round(totalDebit),
  totalCredit: Math.round(totalCredit),
  netSavings: Math.round(totalCredit - totalDebit),
  healthScore: Math.min(92, Math.max(60, Math.round((totalCredit / (totalDebit + 1)) * 50))),
  monthlyExpenses,
  categoryBreakdown,
}

export const predictions: Prediction[] = [
  { month: "Feb 2026", predicted: 28500, actual: 27800, confidence: 92 },
  { month: "Mar 2026", predicted: 31200, confidence: 88 },
  { month: "Apr 2026", predicted: 26800, confidence: 85 },
  { month: "May 2026", predicted: 33400, confidence: 80 },
  { month: "Jun 2026", predicted: 29100, confidence: 76 },
  { month: "Jul 2026", predicted: 35600, confidence: 72 },
]

export const recommendations: Recommendation[] = [
  {
    id: "rec_1",
    title: "Reduce Food Delivery Spending",
    description:
      "You spent 40% more on food delivery this month compared to last month. You ordered from Uber Eats 32 times and Zomato 18 times. Switching to cheaper alternatives and cooking at home 3 more days/week could save you big.",
    savings: 3200,
    priority: "high",
    category: "Food & Dining",
    icon: "utensils",
    currentSpending: 12300,
    targetSpending: 9100,
    aiInsight:
      "Your average food order is ~385. Users with similar income profiles spend ~240/order by choosing value meals and budget restaurants.",
    alternatives: [
      {
        name: "EatSure by Rebel Foods",
        type: "app",
        reason: "Combo meals avg ~180 vs your ~385 Uber Eats orders. Multi-brand kitchen with consistent quality.",
        estimatedSavings: 1200,
        rating: 4.3,
        discount: "Flat 50% off on first 5 orders",
      },
      {
        name: "Aahar - Local Tiffin Service",
        type: "restaurant",
        reason: "Home-style meals at ~120/thali near your area. Healthier & 70% cheaper than delivery apps.",
        estimatedSavings: 1400,
        rating: 4.6,
      },
      {
        name: "Swiggy Instamart Groceries",
        type: "app",
        reason: "Buy groceries for 3 home-cooked meals/week. ~90/meal vs ~385 delivery. 10-min delivery.",
        estimatedSavings: 600,
        rating: 4.4,
        discount: "Free delivery on orders above 199",
      },
    ],
  },
  {
    id: "rec_2",
    title: "Cancel Unused Subscriptions",
    description:
      "We detected 3 subscriptions you haven't used in the past 30 days: Adobe CC (last used 45 days ago), Notion (last used 38 days ago), and Disney+ (last watched 52 days ago).",
    savings: 1500,
    priority: "high",
    category: "Subscriptions",
    icon: "credit-card",
    currentSpending: 4200,
    targetSpending: 2700,
    aiInsight:
      "You're paying for 7 active subscriptions but regularly using only 4. Bundled plans could replace the remaining ones at 40% less.",
    alternatives: [
      {
        name: "Canva Pro",
        type: "app",
        reason: "Replaces Adobe CC for your usage pattern (basic photo editing & social posts). 75% cheaper.",
        estimatedSavings: 800,
        rating: 4.7,
        discount: "30-day free trial + 50% off annual plan",
      },
      {
        name: "Obsidian (Free)",
        type: "app",
        reason: "Free note-taking app that replaces Notion. Offline-first, markdown-based, no subscription needed.",
        estimatedSavings: 500,
        rating: 4.8,
      },
      {
        name: "JioCinema Premium",
        type: "service",
        reason: "Has most Disney+ content plus IPL cricket at 589/yr vs Disney+ at 1499/yr.",
        estimatedSavings: 200,
        rating: 4.1,
        discount: "Annual plan at 589 (save 76% vs monthly)",
      },
    ],
  },
  {
    id: "rec_3",
    title: "Switch Transportation Mode",
    description:
      "You took 28 Uber rides this month averaging 318/ride. Most rides are during peak hours (8-10 AM, 6-8 PM) where surge pricing adds 40-60% extra.",
    savings: 2800,
    priority: "medium",
    category: "Transportation",
    icon: "car",
    currentSpending: 8900,
    targetSpending: 6100,
    aiInsight:
      "68% of your rides are within 8km of your home. A metro pass + last-mile e-bike combo would cover these trips at 1/3rd the cost.",
    alternatives: [
      {
        name: "Delhi Metro Smart Card",
        type: "transport",
        reason: "Monthly pass for your route (Rajiv Chowk - Huda City) at 1500/mo. Covers 80% of your commute.",
        estimatedSavings: 1800,
        rating: 4.2,
        discount: "10% cashback on auto-recharge via Paytm",
      },
      {
        name: "Yulu E-Bikes",
        type: "app",
        reason: "Last-mile connectivity from metro station to office. ~15/ride vs ~150 auto. Available at all metro stations near you.",
        estimatedSavings: 600,
        rating: 4.0,
        discount: "Unlimited monthly pass at 499",
      },
      {
        name: "Quick Ride (Carpool)",
        type: "app",
        reason: "Verified carpooling for your office route. 3 other users from your area share the same commute timing.",
        estimatedSavings: 400,
        rating: 4.3,
        discount: "First 3 rides free",
      },
    ],
  },
  {
    id: "rec_4",
    title: "Optimize Online Shopping",
    description:
      "Your shopping peaks on weekends with 30% higher spending. You made 18 Amazon and 12 Flipkart orders this month. Price comparison shows you overpaid on 40% of purchases.",
    savings: 4500,
    priority: "medium",
    category: "Shopping",
    icon: "shopping-bag",
    currentSpending: 24500,
    targetSpending: 20000,
    aiInsight:
      "You tend to buy electronics and fashion at full price. Waiting for sale events and using cashback apps would have saved ~4,500 on your recent purchases alone.",
    alternatives: [
      {
        name: "CashKaro / GoPaisa",
        type: "app",
        reason: "Get 5-15% cashback on Amazon & Flipkart purchases you're already making. Works on top of existing discounts.",
        estimatedSavings: 1800,
        rating: 4.4,
        discount: "Extra 100 sign-up bonus",
      },
      {
        name: "Price History Tracker (Keepa)",
        type: "app",
        reason: "Browser extension showing price history for Amazon products. 6 of your recent purchases were at their 90-day highest price.",
        estimatedSavings: 1500,
        rating: 4.6,
      },
      {
        name: "Meesho / Shopsy",
        type: "app",
        reason: "For fashion & home items, prices are 40-60% lower than Amazon/Myntra for similar quality. Free delivery on all orders.",
        estimatedSavings: 1200,
        rating: 4.2,
        discount: "Up to 80% off on fashion",
      },
    ],
  },
  {
    id: "rec_5",
    title: "Healthcare Plan Upgrade",
    description:
      "You've spent 8,000 on out-of-pocket medical expenses across Apollo Pharmacy and Dr. Smith Clinic visits. A comprehensive health plan would cover most of these.",
    savings: 1800,
    priority: "low",
    category: "Healthcare",
    icon: "heart-pulse",
    currentSpending: 8000,
    targetSpending: 6200,
    aiInsight:
      "Your pharmacy spending pattern suggests recurring prescriptions. Generic medicine alternatives and a proper health insurance plan would reduce costs significantly.",
    alternatives: [
      {
        name: "PharmEasy Generic Meds",
        type: "app",
        reason: "Switch to generic versions of your regular medicines. Same composition, FSSAI-approved, 60-80% cheaper.",
        estimatedSavings: 800,
        rating: 4.5,
        discount: "Flat 25% off + free delivery on first order",
      },
      {
        name: "Star Health Insurance - Young Star",
        type: "plan",
        reason: "Covers OPD visits, pharmacy, and hospitalization. 5L cover at ~650/mo for your age group. All your recent expenses would be covered.",
        estimatedSavings: 700,
        rating: 4.3,
      },
      {
        name: "Practo Health Plans",
        type: "service",
        reason: "Unlimited online consultations at 249/mo instead of your avg 800/visit at Dr. Smith Clinic. Includes free medicine delivery.",
        estimatedSavings: 300,
        rating: 4.4,
        discount: "First consultation free",
      },
    ],
  },
  {
    id: "rec_6",
    title: "Bundle Entertainment Services",
    description:
      "You subscribe to Netflix (649), Spotify (119), BookMyShow (movie tickets avg 800/mo), and Steam (avg 500/mo on games). Bundled options can cut costs by 35%.",
    savings: 600,
    priority: "low",
    category: "Entertainment",
    icon: "tv",
    currentSpending: 2068,
    targetSpending: 1468,
    aiInsight:
      "Your Netflix usage is mostly on weekends (8 hrs/week). A mobile-only plan at 149/mo gives you the same content. Spotify can be replaced with YouTube Music via existing YouTube Premium.",
    alternatives: [
      {
        name: "Netflix Mobile Plan",
        type: "service",
        reason: "You watch 90% on phone. Mobile plan at 149/mo vs your current 649/mo Standard plan. Same content library.",
        estimatedSavings: 300,
        rating: 4.0,
      },
      {
        name: "YouTube Premium Family",
        type: "service",
        reason: "Includes YouTube Music (replaces Spotify), ad-free YouTube, and YouTube Originals. Split with family for ~50/person/mo.",
        estimatedSavings: 200,
        rating: 4.5,
        discount: "2-month free trial available",
      },
      {
        name: "BookMyShow Stream + Offers",
        type: "app",
        reason: "Use BOGO offers on movie tickets via your ICICI card (detected in transactions). Saves ~400/mo on weekend movies.",
        estimatedSavings: 100,
        rating: 4.3,
        discount: "Buy 1 Get 1 on weekdays with ICICI",
      },
    ],
  },
]

export const merchantSpending: MerchantSpending[] = [
  { merchant: "Amazon", amount: 24500, transactions: 18, category: "Shopping" },
  { merchant: "Uber Eats", amount: 12300, transactions: 32, category: "Food & Dining" },
  { merchant: "Netflix", amount: 3594, transactions: 6, category: "Entertainment" },
  { merchant: "Uber", amount: 8900, transactions: 28, category: "Transportation" },
  { merchant: "Starbucks", amount: 6700, transactions: 22, category: "Food & Dining" },
  { merchant: "Airtel", amount: 5988, transactions: 6, category: "Bills & Utilities" },
  { merchant: "Coursera", amount: 4500, transactions: 3, category: "Education" },
  { merchant: "Spotify", amount: 714, transactions: 6, category: "Subscriptions" },
  { merchant: "Flipkart", amount: 18200, transactions: 12, category: "Shopping" },
  { merchant: "Shell Gas", amount: 7400, transactions: 15, category: "Transportation" },
]

export const weeklyTrends: WeeklyTrend[] = [
  { week: "W1 Dec", amount: 8200 },
  { week: "W2 Dec", amount: 6800 },
  { week: "W3 Dec", amount: 9400 },
  { week: "W4 Dec", amount: 12100 },
  { week: "W1 Jan", amount: 7600 },
  { week: "W2 Jan", amount: 5900 },
  { week: "W3 Jan", amount: 8100 },
  { week: "W4 Jan", amount: 10300 },
]

export const heatmapData = (() => {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  const data: { day: string; hour: number; amount: number }[] = []
  for (const day of days) {
    for (let hour = 6; hour <= 23; hour++) {
      const isWeekend = day === "Sat" || day === "Sun"
      const isPeak = hour >= 11 && hour <= 14
      const isEvening = hour >= 18 && hour <= 21
      let base = Math.random() * 500
      if (isPeak) base += 800
      if (isEvening) base += 1200
      if (isWeekend) base += 600
      data.push({ day, hour, amount: Math.round(base) })
    }
  }
  return data
})()

export const mockUser: User = {
  id: "user_001",
  name: "Rahul Sharma",
  email: "rahul.sharma@example.com",
  avatar: undefined,
}
