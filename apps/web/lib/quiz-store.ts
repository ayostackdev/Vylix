'use client';

import { get, set, del, keys, createStore } from 'idb-keyval'

export interface QuizQuestion {
  id: string
  courseId: string
  courseCode: string
  question: string
  options: string[]
  correctIndex: number
  explanation: string
  topic: string
  year?: string
}

export interface QuizAttempt {
  questionId: string
  selectedIndex: number
  correct: boolean
  timestamp: number
}

export interface TopicPerformance {
  topic: string
  courseCode: string
  totalAttempts: number
  correct: number
  lastAttempted: number
}

const quizStore = createStore('vylix-quiz', 'questions')
const attemptStore = createStore('vylix-quiz-attempts', 'attempts')
const perfStore = createStore('vylix-quiz-performance', 'performance')

export const quizDb = {
  async saveQuestions(courseId: string, questions: QuizQuestion[]) {
    await set(courseId, questions, quizStore)
  },

  async getQuestions(courseId: string): Promise<QuizQuestion[]> {
    return (await get<QuizQuestion[]>(courseId, quizStore)) || []
  },

  async recordAttempt(attempt: QuizAttempt) {
    const all = await get<QuizAttempt[]>('attempts', attemptStore) || []
    all.push(attempt)
    await set('attempts', all, attemptStore)
    await this.updateTopicPerformance(attempt)
  },

  async getAttempts(): Promise<QuizAttempt[]> {
    return (await get<QuizAttempt[]>('attempts', attemptStore)) || []
  },

  async getAttemptsByCourse(courseId: string): Promise<QuizAttempt[]> {
    const all = await this.getAttempts()
    return all.filter(a => a.questionId.startsWith(courseId))
  },

  async updateTopicPerformance(attempt: QuizAttempt) {
    const all = await get<TopicPerformance[]>('topics', perfStore) || []
    const question = await this.findQuestion(attempt.questionId)
    if (!question) return

    const existing = all.find(p => p.topic === question.topic && p.courseCode === question.courseCode)
    if (existing) {
      existing.totalAttempts++
      if (attempt.correct) existing.correct++
      existing.lastAttempted = Date.now()
    } else {
      all.push({
        topic: question.topic,
        courseCode: question.courseCode,
        totalAttempts: 1,
        correct: attempt.correct ? 1 : 0,
        lastAttempted: Date.now(),
      })
    }
    await set('topics', all, perfStore)
  },

  async getTopicPerformance(): Promise<TopicPerformance[]> {
    return (await get<TopicPerformance[]>('topics', perfStore)) || []
  },

  async getWeakTopics(threshold = 0.6): Promise<TopicPerformance[]> {
    const all = await this.getTopicPerformance()
    return all.filter(p => p.totalAttempts >= 2 && p.correct / p.totalAttempts < threshold)
  },

  async findQuestion(questionId: string): Promise<QuizQuestion | null> {
    const allKeys = await keys(quizStore)
    for (const key of allKeys) {
      const questions = await get<QuizQuestion[]>(key, quizStore) || []
      const found = questions.find(q => q.id === questionId)
      if (found) return found
    }
    return null
  },

  async clearAll() {
    const qKeys = await keys(quizStore)
    await Promise.all(qKeys.map(k => del(k, quizStore)))
    await del('attempts', attemptStore)
    await del('topics', perfStore)
  },
}

export const PAST_QUESTIONS: Record<string, QuizQuestion[]> = {
  'c-sta-201': [
    {
      id: 'sta201-q1', courseId: 'c-sta-201', courseCode: 'STA 201',
      question: 'A fair die is rolled twice. What is the probability that the sum of the two rolls is 7?',
      options: ['1/6', '1/12', '1/36', '5/36'],
      correctIndex: 0, explanation: 'There are 6 outcomes that sum to 7 out of 36 total outcomes: (1,6), (2,5), (3,4), (4,3), (5,2), (6,1). So 6/36 = 1/6.',
      topic: 'Probability', year: '2023',
    },
    {
      id: 'sta201-q2', courseId: 'c-sta-201', courseCode: 'STA 201',
      question: 'Two events A and B are independent. P(A) = 0.3, P(B) = 0.4. What is P(A ∪ B)?',
      options: ['0.12', '0.58', '0.70', '0.82'],
      correctIndex: 1, explanation: 'For independent events: P(A∪B) = P(A) + P(B) - P(A)P(B) = 0.3 + 0.4 - 0.12 = 0.58.',
      topic: 'Probability', year: '2023',
    },
    {
      id: 'sta201-q3', courseId: 'c-sta-201', courseCode: 'STA 201',
      question: 'A random variable X has E[X] = 5 and Var(X) = 4. What is E[(X - 3)²]?',
      options: ['4', '8', '16', '20'],
      correctIndex: 1, explanation: 'E[(X-3)²] = Var(X) + (E[X]-3)² = 4 + (5-3)² = 4 + 4 = 8.',
      topic: 'Expectation', year: '2022',
    },
    {
      id: 'sta201-q4', courseId: 'c-sta-201', courseCode: 'STA 201',
      question: 'If X ~ Binomial(n=10, p=0.5), what is P(X ≥ 9)?',
      options: ['0.0107', '0.0547', '0.1094', '0.0010'],
      correctIndex: 0, explanation: 'P(X≥9) = P(X=9) + P(X=10) = C(10,9)(0.5)^10 + C(10,10)(0.5)^10 = 11/1024 ≈ 0.0107.',
      topic: 'Distributions', year: '2022',
    },
    {
      id: 'sta201-q5', courseId: 'c-sta-201', courseCode: 'STA 201',
      question: 'The probability density function of a continuous random variable is f(x) = 2x for 0 < x < 1. What is P(X > 0.5)?',
      options: ['0.25', '0.50', '0.75', '0.33'],
      correctIndex: 2, explanation: 'P(X>0.5) = ∫₀.₅¹ 2x dx = [x²]₀.₅¹ = 1 - 0.25 = 0.75.',
      topic: 'Continuous Distribution', year: '2023',
    },
  ],
  'c-sta-301': [
    {
      id: 'sta301-q1', courseId: 'c-sta-301', courseCode: 'STA 301',
      question: 'In simple linear regression, the coefficient estimate β₁ = 2.5 with standard error 0.5. What is the t-statistic for testing H₀: β₁ = 0?',
      options: ['2.0', '5.0', '1.25', '0.5'],
      correctIndex: 1, explanation: 't = β₁ / SE(β₁) = 2.5 / 0.5 = 5.0.',
      topic: 'Linear Regression', year: '2023',
    },
    {
      id: 'sta301-q2', courseId: 'c-sta-301', courseCode: 'STA 301',
      question: 'R² = 0.64 in a regression model. What is the correlation coefficient between the predictor and response?',
      options: ['0.36', '0.64', '0.80', '0.40'],
      correctIndex: 2, explanation: 'r = √R² = √0.64 = 0.80 (positive by convention).',
      topic: 'Linear Regression', year: '2023',
    },
    {
      id: 'sta301-q3', courseId: 'c-sta-301', courseCode: 'STA 301',
      question: 'What does a Durbin-Watson statistic of approximately 2 indicate?',
      options: ['Positive autocorrelation', 'Negative autocorrelation', 'No autocorrelation', 'Heteroscedasticity'],
      correctIndex: 2, explanation: 'DW ≈ 2 indicates no first-order autocorrelation in the residuals.',
      topic: 'Regression Diagnostics', year: '2022',
    },
    {
      id: 'sta301-q4', courseId: 'c-sta-301', courseCode: 'STA 301',
      question: 'In multiple regression, what problem does VIF > 10 suggest?',
      options: ['Heteroscedasticity', 'Multicollinearity', 'Autocorrelation', 'Non-normality'],
      correctIndex: 1, explanation: 'VIF > 10 indicates severe multicollinearity among predictors.',
      topic: 'Multiple Regression', year: '2022',
    },
  ],
  'c-phy-101': [
    {
      id: 'phy101-q1', courseId: 'c-phy-101', courseCode: 'PHY 101',
      question: 'A car accelerates uniformly from rest to 20 m/s in 10 seconds. What distance does it cover?',
      options: ['50 m', '100 m', '200 m', '400 m'],
      correctIndex: 1, explanation: 's = ½(u+v)t = ½(0+20)(10) = 100 m.',
      topic: 'Kinematics', year: '2023',
    },
    {
      id: 'phy101-q2', courseId: 'c-phy-101', courseCode: 'PHY 101',
      question: 'A 2 kg object is dropped from a height of 45 m. What is its velocity just before hitting the ground? (g = 10 m/s²)',
      options: ['20 m/s', '30 m/s', '40 m/s', '15 m/s'],
      correctIndex: 1, explanation: 'v² = u² + 2gh = 0 + 2(10)(45) = 900, so v = 30 m/s.',
      topic: 'Kinematics', year: '2023',
    },
    {
      id: 'phy101-q3', courseId: 'c-phy-101', courseCode: 'PHY 101',
      question: 'A force of 10 N acts on a body of mass 2 kg for 4 seconds. What is the change in momentum?',
      options: ['20 kg·m/s', '40 kg·m/s', '10 kg·m/s', '80 kg·m/s'],
      correctIndex: 1, explanation: 'Δp = F·t = 10 × 4 = 40 kg·m/s.',
      topic: 'Momentum', year: '2022',
    },
    {
      id: 'phy101-q4', courseId: 'c-phy-101', courseCode: 'PHY 101',
      question: 'A 5 kg block on a frictionless surface is pulled by a 20 N force at 60° to the horizontal. What is the acceleration?',
      options: ['4 m/s²', '3.46 m/s²', '2 m/s²', '10 m/s²'],
      correctIndex: 2, explanation: 'Fx = F·cos60° = 20 × 0.5 = 10 N. a = Fx/m = 10/5 = 2 m/s².',
      topic: 'Newton\'s Laws', year: '2022',
    },
  ],
  'c-chm-101': [
    {
      id: 'chm101-q1', courseId: 'c-chm-101', courseCode: 'CHM 101',
      question: 'How many moles are in 12 g of Carbon-12? (Atomic mass of C = 12 g/mol)',
      options: ['0.5 mol', '1.0 mol', '1.5 mol', '2.0 mol'],
      correctIndex: 1, explanation: 'n = m/M = 12/12 = 1.0 mol.',
      topic: 'Stoichiometry', year: '2023',
    },
    {
      id: 'chm101-q2', courseId: 'c-chm-101', courseCode: 'CHM 101',
      question: 'What is the electron configuration of Oxygen (Z = 8)?',
      options: ['1s²2s²2p⁴', '1s²2s²2p⁶', '1s²2s²2p²', '1s²2s²2p⁶3s²'],
      correctIndex: 0, explanation: 'Oxygen has 8 electrons: 1s²2s²2p⁴.',
      topic: 'Atomic Structure', year: '2023',
    },
    {
      id: 'chm101-q3', courseId: 'c-chm-101', courseCode: 'CHM 101',
      question: 'What is the pH of a 0.001 M HCl solution?',
      options: ['1', '2', '3', '11'],
      correctIndex: 2, explanation: 'pH = -log[H⁺] = -log(0.001) = 3.',
      topic: 'Acids and Bases', year: '2022',
    },
    {
      id: 'chm101-q4', courseId: 'c-chm-101', courseCode: 'CHM 101',
      question: 'Which bond type involves the complete transfer of electrons?',
      options: ['Covalent', 'Ionic', 'Metallic', 'Hydrogen'],
      correctIndex: 1, explanation: 'Ionic bonds involve complete transfer of electrons from one atom to another.',
      topic: 'Chemical Bonding', year: '2022',
    },
  ],
  'c-mth-101': [
    {
      id: 'mth101-q1', courseId: 'c-mth-101', courseCode: 'MTH 101',
      question: 'Find dy/dx if y = x³ + 2x² - 5x + 3',
      options: ['3x² + 4x - 5', '3x² + 4x', 'x² + 2x - 5', '3x² + 2x - 5'],
      correctIndex: 0, explanation: 'd/dx(x³) = 3x², d/dx(2x²) = 4x, d/dx(-5x) = -5, d/dx(3) = 0.',
      topic: 'Differentiation', year: '2023',
    },
    {
      id: 'mth101-q2', courseId: 'c-mth-101', courseCode: 'MTH 101',
      question: 'Evaluate ∫(2x + 3)dx',
      options: ['x² + 3x + C', '2x² + 3x + C', 'x² + C', 'x² + 3 + C'],
      correctIndex: 0, explanation: '∫2x dx = x², ∫3 dx = 3x. So ∫(2x+3)dx = x² + 3x + C.',
      topic: 'Integration', year: '2023',
    },
    {
      id: 'mth101-q3', courseId: 'c-mth-101', courseCode: 'MTH 101',
      question: 'Solve for x: 2^(x+1) = 8',
      options: ['1', '2', '3', '4'],
      correctIndex: 1, explanation: '8 = 2³, so 2^(x+1) = 2³, therefore x+1 = 3, x = 2.',
      topic: 'Exponentials', year: '2022',
    },
    {
      id: 'mth101-q4', courseId: 'c-mth-101', courseCode: 'MTH 101',
      question: 'The limit of (x² - 1)/(x - 1) as x approaches 1 is:',
      options: ['0', '1', '2', 'Undefined'],
      correctIndex: 2, explanation: '(x²-1)/(x-1) = (x-1)(x+1)/(x-1) = x+1, so limit = 1+1 = 2.',
      topic: 'Limits', year: '2022',
    },
  ],
}
