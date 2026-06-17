import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Helper: deterministic-ish random date spread across semesters
// ---------------------------------------------------------------------------
function randomDate(from: Date, to: Date): Date {
  const diff = to.getTime() - from.getTime();
  return new Date(from.getTime() + Math.random() * diff);
}

// ---------------------------------------------------------------------------
// Helper: pick a random item from an array
// ---------------------------------------------------------------------------
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// Helper: build a realistic file name
// ---------------------------------------------------------------------------
function fileName(courseCode: string, topicTitle: string, ext = 'pdf'): string {
  const slug = topicTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40);
  return `${courseCode}_${slug}.${ext}`;
}

// ---------------------------------------------------------------------------
// Colleges & Departments (structure only, no change from before)
// ---------------------------------------------------------------------------
const colleges = [
  {
    code: 'COLCOMS',
    name: 'College of Computing Sciences',
    durationYears: 4,
    departments: [
      { code: 'CSC', name: 'Computer Science', courses: [
        { code: 'CSC101', title: 'Introduction to Computer Science', level: 100 },
        { code: 'CSC201', title: 'Object-Oriented Programming', level: 200 },
        { code: 'CSC301', title: 'Data Structures and Algorithms', level: 300 },
      ]},
      { code: 'CYB', name: 'Cyber Security', courses: [
        { code: 'CYB101', title: 'Introduction to Cyber Security', level: 100 },
        { code: 'CYB201', title: 'Network Security Fundamentals', level: 200 },
      ]},
      { code: 'DTS', name: 'Data Science', courses: [
        { code: 'DTS201', title: 'Introduction to Data Science', level: 200 },
        { code: 'DTS301', title: 'Machine Learning', level: 300 },
      ]},
      { code: 'ICT', name: 'Information Communication Technology', courses: [
        { code: 'ICT101', title: 'Introduction to ICT', level: 100 },
        { code: 'ICT202', title: 'Network Administration', level: 200 },
      ]},
      { code: 'INS', name: 'Information Systems', courses: [
        { code: 'INS201', title: 'Database Management Systems', level: 200 },
        { code: 'INS302', title: 'Systems Analysis and Design', level: 300 },
      ]},
      { code: 'INF', name: 'Information Technology', courses: [
        { code: 'INF101', title: 'Fundamentals of IT', level: 100 },
        { code: 'INF204', title: 'Web Technologies', level: 200 },
      ]},
      { code: 'SEN', name: 'Software Engineering', courses: [
        { code: 'SEN201', title: 'Software Requirements Engineering', level: 200 },
        { code: 'SEN301', title: 'Software Design and Architecture', level: 300 },
      ]},
    ],
  },
  {
    code: 'COLENG',
    name: 'College of Engineering',
    durationYears: 5,
    departments: [
      { code: 'ABE', name: 'Agricultural and Bio-Resources Engineering', courses: [
        { code: 'ABE201', title: 'Agricultural Engineering Principles', level: 200 },
        { code: 'ABE301', title: 'Farm Power and Machinery', level: 300 },
      ]},
      { code: 'CVE', name: 'Civil Engineering', courses: [
        { code: 'CVE201', title: 'Engineering Mechanics', level: 200 },
        { code: 'CVE301', title: 'Structural Analysis I', level: 300 },
      ]},
      { code: 'EEE', name: 'Electrical and Electronics Engineering', courses: [
        { code: 'EEE201', title: 'Basic Electrical Engineering', level: 200 },
        { code: 'EEE303', title: 'Electromagnetic Fields and Waves', level: 300 },
      ]},
      { code: 'MEE', name: 'Mechanical Engineering', courses: [
        { code: 'MEE201', title: 'Thermodynamics I', level: 200 },
        { code: 'MEE301', title: 'Fluid Mechanics', level: 300 },
      ]},
      { code: 'MTE', name: 'Mechatronics Engineering', courses: [
        { code: 'MTE201', title: 'Introduction to Mechatronics', level: 200 },
        { code: 'MTE302', title: 'Robotics and Control Systems', level: 300 },
      ]},
    ],
  },
  {
    code: 'COLNAS',
    name: 'College of Natural Sciences',
    durationYears: 4,
    departments: [
      { code: 'BCH', name: 'Biochemistry', courses: [
        { code: 'BCH201', title: 'General Biochemistry I', level: 200 },
        { code: 'BCH301', title: 'Enzyme Kinetics', level: 300 },
      ]},
      { code: 'MCB', name: 'Microbiology', courses: [
        { code: 'MCB201', title: 'General Microbiology', level: 200 },
        { code: 'MCB302', title: 'Microbial Physiology', level: 300 },
      ]},
      { code: 'CHM', name: 'Chemistry', courses: [
        { code: 'CHM101', title: 'General Chemistry', level: 100 },
        { code: 'CHM231', title: 'Organic Chemistry I', level: 200 },
      ]},
      { code: 'MTH', name: 'Mathematics', courses: [
        { code: 'MTH101', title: 'Elementary Mathematics I', level: 100 },
        { code: 'MTH201', title: 'Mathematical Methods I', level: 200 },
      ]},
      { code: 'PHY', name: 'Physics', courses: [
        { code: 'PHY101', title: 'General Physics I', level: 100 },
        { code: 'PHY202', title: 'Electromagnetism', level: 200 },
      ]},
      { code: 'STA', name: 'Statistics', courses: [
        { code: 'STA201', title: 'Probability and Statistics I', level: 200 },
        { code: 'STA301', title: 'Statistical Inference', level: 300 },
      ]},
    ],
  },
  {
    code: 'COLFHEC',
    name: 'College of Food Science and Human Ecology',
    durationYears: 4,
    departments: [
      { code: 'FST', name: 'Food Science and Technology', courses: [
        { code: 'FST201', title: 'Food Chemistry', level: 200 },
        { code: 'FST301', title: 'Food Microbiology', level: 300 },
      ]},
      { code: 'NUD', name: 'Nutrition and Dietetics', courses: [
        { code: 'NUD201', title: 'Principles of Nutrition', level: 200 },
        { code: 'NUD302', title: 'Clinical Nutrition', level: 300 },
      ]},
      { code: 'HSM', name: 'Home Science and Management', courses: [
        { code: 'HSM101', title: 'Introduction to Home Science', level: 100 },
        { code: 'HSM202', title: 'Family Resource Management', level: 200 },
      ]},
      { code: 'HMT', name: 'Hospitality and Tourism', courses: [
        { code: 'HMT201', title: 'Introduction to Hospitality', level: 200 },
        { code: 'HMT301', title: 'Tourism Planning and Development', level: 300 },
      ]},
    ],
  },
  {
    code: 'COLERM',
    name: 'College of Environmental Resources Management',
    durationYears: 4,
    departments: [
      { code: 'EMT', name: 'Environmental Management and Toxicology', courses: [
        { code: 'EMT201', title: 'Environmental Science', level: 200 },
        { code: 'EMT301', title: 'Environmental Impact Assessment', level: 300 },
      ]},
      { code: 'AQF', name: 'Aquaculture and Fisheries Management', courses: [
        { code: 'AQF201', title: 'Principles of Aquaculture', level: 200 },
        { code: 'AQF302', title: 'Fish Nutrition and Feed Technology', level: 300 },
      ]},
      { code: 'FRM', name: 'Forest Resource Management', courses: [
        { code: 'FRM201', title: 'Forest Ecology', level: 200 },
        { code: 'FRM301', title: 'Forest Management and Economics', level: 300 },
      ]},
      { code: 'GLY', name: 'Geology', courses: [
        { code: 'GLY201', title: 'Mineralogy', level: 200 },
        { code: 'GLY301', title: 'Structural Geology', level: 300 },
      ]},
    ],
  },
  {
    code: 'COLPLANT',
    name: 'College of Plant Science and Crop Production',
    durationYears: 4,
    departments: [
      { code: 'CRP', name: 'Crop Protection', courses: [
        { code: 'CRP201', title: 'General Entomology', level: 200 },
        { code: 'CRP301', title: 'Plant Pathology', level: 300 },
      ]},
      { code: 'HRT', name: 'Horticulture', courses: [
        { code: 'HRT201', title: 'General Horticulture', level: 200 },
        { code: 'HRT302', title: 'Pomology', level: 300 },
      ]},
      { code: 'SLM', name: 'Soil Science and Land Management', courses: [
        { code: 'SLM201', title: 'General Soil Science', level: 200 },
        { code: 'SLM301', title: 'Soil Fertility and Management', level: 300 },
      ]},
    ],
  },
  {
    code: 'COLANIM',
    name: 'College of Animal Science and Livestock Production',
    durationYears: 4,
    departments: [
      { code: 'ABG', name: 'Animal Breeding and Genetics', courses: [
        { code: 'ABG201', title: 'Principles of Animal Genetics', level: 200 },
        { code: 'ABG301', title: 'Animal Breeding Methods', level: 300 },
      ]},
      { code: 'ANU', name: 'Animal Nutrition', courses: [
        { code: 'ANU201', title: 'Animal Nutrition I', level: 200 },
        { code: 'ANU302', title: 'Ruminant Nutrition', level: 300 },
      ]},
      { code: 'APH', name: 'Animal Production and Health', courses: [
        { code: 'APH201', title: 'Animal Production I', level: 200 },
        { code: 'APH301', title: 'Animal Health Management', level: 300 },
      ]},
    ],
  },
  {
    code: 'COLAMRUD',
    name: 'College of Agricultural Management and Rural Development',
    durationYears: 4,
    departments: [
      { code: 'AEF', name: 'Agricultural Economics and Farm Management', courses: [
        { code: 'AEF201', title: 'Principles of Agricultural Economics', level: 200 },
        { code: 'AEF301', title: 'Farm Management and Production Economics', level: 300 },
      ]},
      { code: 'AEX', name: 'Agricultural Extension and Rural Development', courses: [
        { code: 'AEX201', title: 'Agricultural Extension Methods', level: 200 },
        { code: 'AEX302', title: 'Rural Development Sociology', level: 300 },
      ]},
    ],
  },
  {
    code: 'COLEDS',
    name: 'College of Entrepreneurial and Development Studies',
    durationYears: 4,
    departments: [
      { code: 'ACC', name: 'Accounting', courses: [
        { code: 'ACC201', title: 'Financial Accounting I', level: 200 },
        { code: 'ACC301', title: 'Cost and Management Accounting', level: 300 },
      ]},
      { code: 'BFN', name: 'Banking and Finance', courses: [
        { code: 'BFN201', title: 'Money and Banking', level: 200 },
        { code: 'BFN302', title: 'Financial Management', level: 300 },
      ]},
      { code: 'BAD', name: 'Business Administration', courses: [
        { code: 'BAD101', title: 'Introduction to Business', level: 100 },
        { code: 'BAD202', title: 'Organizational Behaviour', level: 200 },
      ]},
      { code: 'ECN', name: 'Economics', courses: [
        { code: 'ECN101', title: 'Principles of Economics I', level: 100 },
        { code: 'ECN201', title: 'Microeconomic Theory I', level: 200 },
      ]},
    ],
  },
  {
    code: 'COLVET',
    name: 'College of Veterinary Medicine',
    durationYears: 5,
    departments: [
      { code: 'VET', name: 'Veterinary Medicine', courses: [
        { code: 'VET201', title: 'Veterinary Anatomy', level: 200 },
        { code: 'VET301', title: 'Veterinary Physiology', level: 300 },
        { code: 'VET401', title: 'Veterinary Pharmacology', level: 400 },
      ]},
    ],
  },
];

// ---------------------------------------------------------------------------
// Topic templates — generate 2–3 per course
// ---------------------------------------------------------------------------
const topicTemplates = [
  { title: 'Lecture Notes', suffixes: ['Comprehensive Lecture Notes', 'Lecture Slides and Notes'] },
  { title: 'Past Questions', suffixes: ['Past Examination Questions', 'Revision Past Questions'] },
  { title: 'Assignments', suffixes: ['Practical Assignments', 'Tutorial Exercises and Solutions'] },
];

// ---------------------------------------------------------------------------
// Placeholder content for seed materials (pre-processed)
// ---------------------------------------------------------------------------
function generateSeedSummary(courseTitle: string, topicTitle: string): string {
  return `This document covers ${topicTitle.toLowerCase()} for ${courseTitle}. Prepared by the department as reference material for students. Covers core concepts, key definitions, and foundational knowledge required for academic progression.`;
}

const sampleQuestions = [
  'What are the key concepts covered in this material?',
  'How do the principles discussed apply to real-world scenarios?',
  'What are the common examination pitfalls students should avoid?',
  'Explain the relationship between the main topics in this document.',
  'How would you summarise the core message in three sentences?',
  'What practical skills can be developed from studying this material?',
  'Identify the most frequently tested areas from this topic.',
  'Describe how this topic connects to other courses in the curriculum.',
  'What are the emerging trends in this area of study?',
  'How can students effectively revise using this material?',
];

const sampleTips = [
  'Focus on understanding the underlying principles, not just memorising facts.',
  'Create a mind map connecting key concepts from this material.',
  'Discuss the content with classmates to reinforce understanding.',
  'Attempt past questions under timed conditions after studying.',
  'Make concise notes as you read through the material.',
  'Identify areas of weakness and allocate extra revision time to them.',
  'Use the Pomodoro technique when studying this material.',
  'Form study groups to cover the content collaboratively.',
  'Practice explaining concepts out loud as if teaching someone else.',
  'Review this material again after 24 hours to improve retention.',
];

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------
async function main() {
  console.log('Seeding FUNAAB academic structure and cold-start materials...');
  console.log('');

  // ---- 1. Seed colleges and departments first ----
  let firstCollegeId = '';
  let firstDepartmentId = '';

  for (const collegeDef of colleges) {
    const college = await prisma.college.upsert({
      where: { code: collegeDef.code },
      update: { name: collegeDef.name, durationYears: collegeDef.durationYears },
      create: { code: collegeDef.code, name: collegeDef.name, durationYears: collegeDef.durationYears },
    });

    if (!firstCollegeId) firstCollegeId = college.id;

    for (const deptDef of collegeDef.departments) {
      const department = await prisma.department.upsert({
        where: { code: deptDef.code },
        update: { name: deptDef.name, collegeId: college.id },
        create: { code: deptDef.code, name: deptDef.name, collegeId: college.id },
      });

      if (!firstDepartmentId) firstDepartmentId = department.id;
    }
  }

  console.log(`  Seeded ${colleges.length} colleges and all departments.`);

  // ---- 2. Ensure Vault System user exists ----
  const vaultEmail = 'vault.system@vylix.local';

  let vaultUser = await prisma.user.findFirst({
    where: { emails: { some: { email: vaultEmail } } },
  });

  if (!vaultUser) {
    console.log('  Creating Vault System user for seed materials...');
    vaultUser = await prisma.user.create({
      data: {
        fullName: 'Vault System',
        matricNumber: 'VAULT-SYSTEM',
        entryYear: new Date().getFullYear(),
        currentLevel: '100L',
        status: 'STUDENT',
        collegeId: firstCollegeId,
        departmentId: firstDepartmentId,
        emails: {
          create: {
            email: vaultEmail,
            isPrimary: true,
            isVerified: true,
          },
        },
      },
    });
  }

  const vaultUserId = vaultUser.id;

  // ---- 3. Seed courses, topics, materials ----
  const seedStart = new Date('2024-08-01');
  const seedEnd = new Date('2025-06-30');
  let totalMaterials = 0;

  for (const collegeDef of colleges) {
    for (const deptDef of collegeDef.departments) {
      const department = await prisma.department.findUniqueOrThrow({ where: { code: deptDef.code } });

      for (const courseDef of deptDef.courses) {
        const course = await prisma.course.upsert({
          where: { code: courseDef.code },
          update: { title: courseDef.title, level: courseDef.level, departmentId: department.id },
          create: {
            code: courseDef.code,
            title: courseDef.title,
            level: courseDef.level,
            departmentId: department.id,
            isGeneral: false,
          },
        });

        // Create 2 topics per course
        for (const template of topicTemplates.slice(0, 2)) {
          const suffix = pick(template.suffixes);
          const topicTitle = `${courseDef.code} ${suffix}`;

          const topic = await prisma.topic.create({
            data: {
              title: topicTitle,
              courseId: course.id,
              authorId: vaultUserId,
              isActive: true,
            },
          });

          // Create 1–2 materials per topic
          const materialCount = Math.random() > 0.5 ? 2 : 1;
          for (let m = 0; m < materialCount; m++) {
            const matTitle = m === 0
              ? topicTitle
              : `${topicTitle} - Set ${m + 1}`;

            const matDate = randomDate(seedStart, seedEnd);
            const ext = pick(['pdf', 'pdf', 'pdf', 'png']);
            const fName = fileName(courseDef.code, matTitle, ext);

            await prisma.material.create({
              data: {
                fileName: fName,
                fileUrl: `/seed/${courseDef.code}/${fName}`,
                fileSize: Math.floor(50000 + Math.random() * 950000),
                topicId: topic.id,
                uploaderId: vaultUserId,
                processingStatus: 'COMPLETED',
                summary: generateSeedSummary(courseDef.title, matTitle),
                questions: sampleQuestions.slice(0, 3 + Math.floor(Math.random() * 3)),
                tips: sampleTips.slice(0, 3 + Math.floor(Math.random() * 3)),
                processedAt: matDate,
                uploadedAt: matDate,
                isSeed: true,
                isPastQuestion: template.title === 'Past Questions',
                examYear: template.title === 'Past Questions' ? matDate.getFullYear() : null,
                semester: pick(['First Semester', 'Second Semester', null]),
              },
            });

            totalMaterials++;
          }
        }
      }
    }
  }

  console.log(`  Seeded ${totalMaterials} cold-start materials across all colleges.`);
  console.log('');
  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
