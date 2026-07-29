import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import University, College, Department, DepartmentCatalog

router = APIRouter(prefix="/colleges", tags=["colleges"])

# ── Schemas ────────────────────────────────────────────────────────


class CollegeOut(BaseModel):
    id: str
    code: str
    name: str
    duration_years: int

    model_config = {"from_attributes": True}


class DepartmentOut(BaseModel):
    id: str
    code: str
    name: str

    model_config = {"from_attributes": True}


class UniversityOut(BaseModel):
    id: str
    code: str
    name: str

    model_config = {"from_attributes": True}


# ── Endpoints ──────────────────────────────────────────────────────


@router.get("", response_model=list[UniversityOut])
async def list_universities(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(University).order_by(University.name))
    return result.scalars().all()


@router.get("/{university_id}/colleges", response_model=list[CollegeOut])
async def list_colleges(university_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(College).where(College.university_id == university_id).order_by(College.name)
    )
    return result.scalars().all()


@router.get("/colleges/{college_id}/departments", response_model=list[DepartmentOut])
async def list_departments(college_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Department).where(Department.college_id == college_id).order_by(Department.name)
    )
    return result.scalars().all()


# ── Seed data (University → College → Departments) ────────────────

SEED_DATA: list[dict] = [
    {
        "code": "UNILAG",
        "name": "University of Lagos",
        "colleges": [
            {
                "code": "SCI",
                "name": "Faculty of Science",
                "duration_years": 4,
                "departments": [
                    ("CSC", "Computer Science"),
                    ("BCH", "Biochemistry"),
                    ("CHM", "Chemistry"),
                    ("PHY", "Physics"),
                    ("MTH", "Mathematics"),
                    ("BIO", "Biology"),
                ],
            },
            {
                "code": "ENG",
                "name": "Faculty of Engineering",
                "duration_years": 5,
                "departments": [
                    ("EEE", "Electrical & Electronics Engineering"),
                    ("MEE", "Mechanical Engineering"),
                    ("CVE", "Civil Engineering"),
                ],
            },
            {
                "code": "BUS",
                "name": "Faculty of Business Administration",
                "duration_years": 4,
                "departments": [
                    ("ACC", "Accounting"),
                    ("BUS", "Business Administration"),
                    ("ECO", "Economics"),
                ],
            },
            {
                "code": "LAW",
                "name": "Faculty of Law",
                "duration_years": 5,
                "departments": [("LAW", "Law")],
            },
            {
                "code": "MED",
                "name": "Faculty of Medicine",
                "duration_years": 6,
                "departments": [("MBB", "Medicine & Surgery")],
            },
        ],
    },
    {
        "code": "UI",
        "name": "University of Ibadan",
        "colleges": [
            {
                "code": "SCI",
                "name": "Faculty of Science",
                "duration_years": 4,
                "departments": [
                    ("CSC", "Computer Science"),
                    ("BCH", "Biochemistry"),
                    ("CHM", "Chemistry"),
                    ("PHY", "Physics"),
                    ("MTH", "Mathematics"),
                ],
            },
            {
                "code": "ENG",
                "name": "Faculty of Engineering",
                "duration_years": 5,
                "departments": [
                    ("EEE", "Electrical & Electronics Engineering"),
                    ("MEE", "Mechanical Engineering"),
                ],
            },
            {
                "code": "BUS",
                "name": "Faculty of Business Administration",
                "duration_years": 4,
                "departments": [
                    ("ACC", "Accounting"),
                    ("ECO", "Economics"),
                ],
            },
            {
                "code": "LAW",
                "name": "Faculty of Law",
                "duration_years": 5,
                "departments": [("LAW", "Law")],
            },
            {
                "code": "MED",
                "name": "Faculty of Medicine",
                "duration_years": 6,
                "departments": [
                    ("MBB", "Medicine & Surgery"),
                    ("NSC", "Nursing Science"),
                    ("PHA", "Pharmacy"),
                ],
            },
        ],
    },
    {
        "code": "OAU",
        "name": "Obafemi Awolowo University",
        "colleges": [
            {
                "code": "SCI",
                "name": "Faculty of Science",
                "duration_years": 4,
                "departments": [
                    ("CSC", "Computer Science"),
                    ("BCH", "Biochemistry"),
                    ("CHM", "Chemistry"),
                    ("PHY", "Physics"),
                    ("MTH", "Mathematics"),
                ],
            },
            {
                "code": "ENG",
                "name": "Faculty of Engineering",
                "duration_years": 5,
                "departments": [
                    ("EEE", "Electrical & Electronics Engineering"),
                    ("MEE", "Mechanical Engineering"),
                    ("CVE", "Civil Engineering"),
                ],
            },
            {
                "code": "BUS",
                "name": "Faculty of Business Administration",
                "duration_years": 4,
                "departments": [
                    ("ACC", "Accounting"),
                    ("ECO", "Economics"),
                ],
            },
            {
                "code": "LAW",
                "name": "Faculty of Law",
                "duration_years": 5,
                "departments": [("LAW", "Law")],
            },
            {
                "code": "MED",
                "name": "Faculty of Pharmacy",
                "duration_years": 5,
                "departments": [("PHA", "Pharmacy")],
            },
        ],
    },
    {
        "code": "UNN",
        "name": "University of Nigeria, Nsukka",
        "colleges": [
            {
                "code": "SCI",
                "name": "Faculty of Science",
                "duration_years": 4,
                "departments": [
                    ("CSC", "Computer Science"),
                    ("BCH", "Biochemistry"),
                    ("CHM", "Chemistry"),
                    ("PHY", "Physics"),
                    ("MTH", "Mathematics"),
                ],
            },
            {
                "code": "ENG",
                "name": "Faculty of Engineering",
                "duration_years": 5,
                "departments": [
                    ("EEE", "Electrical & Electronics Engineering"),
                    ("MEE", "Mechanical Engineering"),
                    ("CVE", "Civil Engineering"),
                ],
            },
            {
                "code": "BUS",
                "name": "Faculty of Business Administration",
                "duration_years": 4,
                "departments": [
                    ("ACC", "Accounting"),
                    ("ECO", "Economics"),
                ],
            },
            {
                "code": "LAW",
                "name": "Faculty of Law",
                "duration_years": 5,
                "departments": [("LAW", "Law")],
            },
            {
                "code": "MED",
                "name": "Faculty of Medicine",
                "duration_years": 6,
                "departments": [("MBB", "Medicine & Surgery")],
            },
        ],
    },
    {
        "code": "ABU",
        "name": "Ahmadu Bello University, Zaria",
        "colleges": [
            {
                "code": "SCI",
                "name": "Faculty of Science",
                "duration_years": 4,
                "departments": [
                    ("CSC", "Computer Science"),
                    ("BCH", "Biochemistry"),
                ],
            },
            {
                "code": "ENG",
                "name": "Faculty of Engineering",
                "duration_years": 5,
                "departments": [
                    ("EEE", "Electrical & Electronics Engineering"),
                    ("MEE", "Mechanical Engineering"),
                    ("CVE", "Civil Engineering"),
                ],
            },
            {
                "code": "BUS",
                "name": "Faculty of Business Administration",
                "duration_years": 4,
                "departments": [
                    ("ACC", "Accounting"),
                    ("ECO", "Economics"),
                ],
            },
            {
                "code": "LAW",
                "name": "Faculty of Law",
                "duration_years": 5,
                "departments": [("LAW", "Law")],
            },
            {
                "code": "MED",
                "name": "Faculty of Medicine",
                "duration_years": 6,
                "departments": [("MBB", "Medicine & Surgery")],
            },
        ],
    },
    {
        "code": "UNIBEN",
        "name": "University of Benin",
        "colleges": [
            {
                "code": "SCI",
                "name": "Faculty of Science",
                "duration_years": 4,
                "departments": [
                    ("CSC", "Computer Science"),
                    ("BCH", "Biochemistry"),
                ],
            },
            {
                "code": "ENG",
                "name": "Faculty of Engineering",
                "duration_years": 5,
                "departments": [
                    ("EEE", "Electrical & Electronics Engineering"),
                    ("MEE", "Mechanical Engineering"),
                ],
            },
            {
                "code": "BUS",
                "name": "Faculty of Business Administration",
                "duration_years": 4,
                "departments": [
                    ("ACC", "Accounting"),
                    ("ECO", "Economics"),
                ],
            },
            {
                "code": "LAW",
                "name": "Faculty of Law",
                "duration_years": 5,
                "departments": [("LAW", "Law")],
            },
            {
                "code": "MED",
                "name": "Faculty of Medicine",
                "duration_years": 6,
                "departments": [("MBB", "Medicine & Surgery")],
            },
        ],
    },
    {
        "code": "LASU",
        "name": "Lagos State University, Ojo",
        "colleges": [
            {
                "code": "SCI",
                "name": "Faculty of Science",
                "duration_years": 4,
                "departments": [
                    ("CSC", "Computer Science"),
                    ("BCH", "Biochemistry"),
                ],
            },
            {
                "code": "ENG",
                "name": "Faculty of Engineering",
                "duration_years": 5,
                "departments": [("EEE", "Electrical & Electronics Engineering")],
            },
            {
                "code": "BUS",
                "name": "Faculty of Business Administration",
                "duration_years": 4,
                "departments": [
                    ("ACC", "Accounting"),
                    ("BUS", "Business Administration"),
                    ("ECO", "Economics"),
                ],
            },
            {
                "code": "LAW",
                "name": "Faculty of Law",
                "duration_years": 5,
                "departments": [("LAW", "Law")],
            },
            {
                "code": "MED",
                "name": "Faculty of Medicine",
                "duration_years": 6,
                "departments": [("MBB", "Medicine & Surgery")],
            },
        ],
    },
    {
        "code": "COVENANT",
        "name": "Covenant University, Ota",
        "colleges": [
            {
                "code": "SCI",
                "name": "College of Science & Technology",
                "duration_years": 4,
                "departments": [
                    ("CSC", "Computer Science"),
                    ("BCH", "Biochemistry"),
                ],
            },
            {
                "code": "ENG",
                "name": "College of Engineering",
                "duration_years": 5,
                "departments": [
                    ("EEE", "Electrical & Electronics Engineering"),
                    ("MEE", "Mechanical Engineering"),
                    ("CVE", "Civil Engineering"),
                ],
            },
            {
                "code": "BUS",
                "name": "College of Business & Social Sciences",
                "duration_years": 4,
                "departments": [
                    ("ACC", "Accounting"),
                    ("BUS", "Business Administration"),
                    ("ECO", "Economics"),
                ],
            },
        ],
    },
    {
        "code": "FUNAAB",
        "name": "Federal University of Agriculture, Abeokuta",
        "colleges": [
            {
                "code": "COLAMRUD",
                "name": "College of Agricultural Management & Rural Development",
                "duration_years": 4,
                "departments": [
                    ("AEE", "Agricultural Economics & Extension"),
                    ("AGRM", "Agricultural Resource Management"),
                    ("RDS", "Rural Development & Sociology"),
                ],
            },
            {
                "code": "COLANIM",
                "name": "College of Animal Science & Livestock Production",
                "duration_years": 5,
                "departments": [
                    ("ANS", "Animal Science"),
                    ("NUT", "Animal Nutrition"),
                    ("BREED", "Animal Breeding & Genetics"),
                ],
            },
            {
                "code": "COLBIOS",
                "name": "College of Biosciences",
                "duration_years": 4,
                "departments": [
                    ("BCH", "Biochemistry"),
                    ("BIO", "Biology"),
                    ("MCB", "Microbiology"),
                    ("PLTBIO", "Plant Biology"),
                ],
            },
            {
                "code": "COLCOMPS",
                "name": "College of Computing Sciences",
                "duration_years": 4,
                "departments": [
                    ("CSC", "Computer Science"),
                    ("CYB", "Cyber Security"),
                    ("DS", "Data Science"),
                    ("IS", "Information Systems"),
                ],
            },
            {
                "code": "COLENG",
                "name": "College of Engineering",
                "duration_years": 5,
                "departments": [
                    ("CVE", "Civil Engineering"),
                    ("EEE", "Electrical & Electronics Engineering"),
                    ("MEE", "Mechanical Engineering"),
                    ("AGE", "Agricultural Engineering"),
                    ("FPE", "Food Process Engineering"),
                ],
            },
            {
                "code": "COLERM",
                "name": "College of Environmental Resources Management",
                "duration_years": 4,
                "departments": [
                    ("ESM", "Environmental Management"),
                    ("WRM", "Water Resources Management"),
                    ("FWM", "Forestry & Wildlife Management"),
                ],
            },
            {
                "code": "COLFHEC",
                "name": "College of Food Science & Human Ecology",
                "duration_years": 4,
                "departments": [
                    ("FST", "Food Science & Technology"),
                    ("HND", "Home Economics"),
                    ("HM", "Hospitality Management"),
                ],
            },
            {
                "code": "COLPHYS",
                "name": "College of Physical Sciences",
                "duration_years": 4,
                "departments": [
                    ("CHM", "Chemistry"),
                    ("PHY", "Physics"),
                    ("MTH", "Mathematics"),
                    ("STT", "Statistics"),
                ],
            },
            {
                "code": "COLPLANT",
                "name": "College of Plant Science & Crop Production",
                "duration_years": 4,
                "departments": [
                    ("CSC", "Crop Science & Horticulture"),
                    ("PP", "Plant Pathology"),
                    ("SSS", "Soil Science & Land Management"),
                ],
            },
            {
                "code": "COLVET",
                "name": "College of Veterinary Medicine",
                "duration_years": 5,
                "departments": [
                    ("VMD", "Veterinary Medicine"),
                    ("VPH", "Veterinary Public Health"),
                    ("VPT", "Veterinary Pharmacology"),
                ],
            },
            {
                "code": "COLENDS",
                "name": "College of Entrepreneurial & Development Studies",
                "duration_years": 4,
                "departments": [
                    ("ACC", "Accounting"),
                    ("BUS", "Business Administration"),
                    ("ECO", "Economics"),
                    ("ENT", "Entrepreneurship"),
                    ("BNK", "Banking & Finance"),
                ],
            },
        ],
    },
    {
        "code": "UNILORIN",
        "name": "University of Ilorin",
        "colleges": [
            {
                "code": "SCI",
                "name": "Faculty of Science",
                "duration_years": 4,
                "departments": [
                    ("CSC", "Computer Science"),
                    ("BCH", "Biochemistry"),
                    ("CHM", "Chemistry"),
                    ("PHY", "Physics"),
                    ("MTH", "Mathematics"),
                ],
            },
            {
                "code": "ENG",
                "name": "Faculty of Engineering",
                "duration_years": 5,
                "departments": [
                    ("EEE", "Electrical & Electronics Engineering"),
                    ("MEE", "Mechanical Engineering"),
                ],
            },
            {
                "code": "BUS",
                "name": "Faculty of Business Administration",
                "duration_years": 4,
                "departments": [
                    ("ACC", "Accounting"),
                    ("ECO", "Economics"),
                ],
            },
            {
                "code": "LAW",
                "name": "Faculty of Law",
                "duration_years": 5,
                "departments": [("LAW", "Law")],
            },
            {
                "code": "MED",
                "name": "Faculty of Medicine",
                "duration_years": 6,
                "departments": [("MBB", "Medicine & Surgery")],
            },
        ],
    },
    {
        "code": "BOWEN",
        "name": "Bowen University, Iwo",
        "colleges": [
            {
                "code": "SCI",
                "name": "Faculty of Science",
                "duration_years": 4,
                "departments": [
                    ("CSC", "Computer Science"),
                    ("EEE", "Electrical & Electronics Engineering"),
                ],
            },
            {
                "code": "BUS",
                "name": "Faculty of Business Administration",
                "duration_years": 4,
                "departments": [
                    ("ACC", "Accounting"),
                    ("BUS", "Business Administration"),
                    ("ECO", "Economics"),
                ],
            },
            {
                "code": "MED",
                "name": "Faculty of Medicine",
                "duration_years": 6,
                "departments": [("MBB", "Medicine & Surgery")],
            },
        ],
    },
    {
        "code": "REDEEMERS",
        "name": "Redeemer's University, Ede",
        "colleges": [
            {
                "code": "SCI",
                "name": "College of Science & Technology",
                "duration_years": 4,
                "departments": [("CSC", "Computer Science")],
            },
            {
                "code": "BUS",
                "name": "College of Management Sciences",
                "duration_years": 4,
                "departments": [
                    ("ACC", "Accounting"),
                    ("BUS", "Business Administration"),
                    ("ECO", "Economics"),
                ],
            },
        ],
    },
    {
        "code": "BUK",
        "name": "Bayero University, Kano",
        "colleges": [
            {
                "code": "SCI",
                "name": "Faculty of Science",
                "duration_years": 4,
                "departments": [
                    ("CSC", "Computer Science"),
                    ("BCH", "Biochemistry"),
                ],
            },
            {
                "code": "ENG",
                "name": "Faculty of Engineering",
                "duration_years": 5,
                "departments": [
                    ("EEE", "Electrical & Electronics Engineering"),
                    ("MEE", "Mechanical Engineering"),
                ],
            },
            {
                "code": "BUS",
                "name": "Faculty of Business Administration",
                "duration_years": 4,
                "departments": [
                    ("ACC", "Accounting"),
                    ("ECO", "Economics"),
                ],
            },
            {
                "code": "LAW",
                "name": "Faculty of Law",
                "duration_years": 5,
                "departments": [("LAW", "Law")],
            },
            {
                "code": "MED",
                "name": "Faculty of Medicine",
                "duration_years": 6,
                "departments": [("MBB", "Medicine & Surgery")],
            },
        ],
    },
    {
        "code": "UNIUYO",
        "name": "University of Uyo",
        "colleges": [
            {
                "code": "SCI",
                "name": "Faculty of Science",
                "duration_years": 4,
                "departments": [
                    ("CSC", "Computer Science"),
                    ("BCH", "Biochemistry"),
                ],
            },
            {
                "code": "ENG",
                "name": "Faculty of Engineering",
                "duration_years": 5,
                "departments": [("EEE", "Electrical & Electronics Engineering")],
            },
            {
                "code": "BUS",
                "name": "Faculty of Business Administration",
                "duration_years": 4,
                "departments": [
                    ("ACC", "Accounting"),
                    ("ECO", "Economics"),
                ],
            },
            {
                "code": "LAW",
                "name": "Faculty of Law",
                "duration_years": 5,
                "departments": [("LAW", "Law")],
            },
        ],
    },
    {
        "code": "FUTO",
        "name": "Federal University of Technology, Owerri",
        "colleges": [
            {
                "code": "SCI",
                "name": "School of Science & Technology",
                "duration_years": 4,
                "departments": [("CSC", "Computer Science")],
            },
            {
                "code": "ENG",
                "name": "School of Engineering",
                "duration_years": 5,
                "departments": [
                    ("EEE", "Electrical & Electronics Engineering"),
                    ("MEE", "Mechanical Engineering"),
                    ("CVE", "Civil Engineering"),
                    ("MME", "Materials & Metallurgical Engineering"),
                ],
            },
        ],
    },
    {
        "code": "FUTA",
        "name": "Federal University of Technology, Akure",
        "colleges": [
            {
                "code": "SCI",
                "name": "School of Science",
                "duration_years": 4,
                "departments": [
                    ("CSC", "Computer Science"),
                    ("BCH", "Biochemistry"),
                ],
            },
            {
                "code": "ENG",
                "name": "School of Engineering",
                "duration_years": 5,
                "departments": [
                    ("EEE", "Electrical & Electronics Engineering"),
                    ("MEE", "Mechanical Engineering"),
                    ("CVE", "Civil Engineering"),
                ],
            },
        ],
    },
    {
        "code": "UNIMAID",
        "name": "University of Maiduguri",
        "colleges": [
            {
                "code": "SCI",
                "name": "Faculty of Science",
                "duration_years": 4,
                "departments": [("CSC", "Computer Science")],
            },
            {
                "code": "BUS",
                "name": "Faculty of Business Administration",
                "duration_years": 4,
                "departments": [
                    ("ACC", "Accounting"),
                    ("ECO", "Economics"),
                ],
            },
            {
                "code": "LAW",
                "name": "Faculty of Law",
                "duration_years": 5,
                "departments": [("LAW", "Law")],
            },
            {
                "code": "MED",
                "name": "Faculty of Medicine",
                "duration_years": 6,
                "departments": [("MBB", "Medicine & Surgery")],
            },
        ],
    },
    {
        "code": "LEADCITY",
        "name": "Lead City University, Ibadan",
        "colleges": [
            {
                "code": "SCI",
                "name": "Faculty of Science",
                "duration_years": 4,
                "departments": [("CSC", "Computer Science")],
            },
            {
                "code": "BUS",
                "name": "Faculty of Business Administration",
                "duration_years": 4,
                "departments": [
                    ("ACC", "Accounting"),
                    ("BUS", "Business Administration"),
                    ("ECO", "Economics"),
                ],
            },
            {
                "code": "LAW",
                "name": "Faculty of Law",
                "duration_years": 5,
                "departments": [("LAW", "Law")],
            },
        ],
    },
    {
        "code": "NOUN",
        "name": "National Open University of Nigeria",
        "colleges": [
            {
                "code": "SCI",
                "name": "Faculty of Science",
                "duration_years": 4,
                "departments": [("CSC", "Computer Science")],
            },
            {
                "code": "BUS",
                "name": "Faculty of Management Sciences",
                "duration_years": 4,
                "departments": [
                    ("ACC", "Accounting"),
                    ("BUS", "Business Administration"),
                    ("ECO", "Economics"),
                ],
            },
            {
                "code": "LAW",
                "name": "Faculty of Law",
                "duration_years": 5,
                "departments": [("LAW", "Law")],
            },
        ],
    },
    {
        "code": "DELSU",
        "name": "Delta State University, Abraka",
        "colleges": [
            {
                "code": "SCI",
                "name": "Faculty of Science",
                "duration_years": 4,
                "departments": [("CSC", "Computer Science")],
            },
            {
                "code": "BUS",
                "name": "Faculty of Business Administration",
                "duration_years": 4,
                "departments": [
                    ("ACC", "Accounting"),
                    ("ECO", "Economics"),
                ],
            },
            {
                "code": "LAW",
                "name": "Faculty of Law",
                "duration_years": 5,
                "departments": [("LAW", "Law")],
            },
        ],
    },
]


@router.post("/seed")
async def seed_colleges(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(University))
    existing = result.scalars().all()
    if existing:
        return {"message": f"Already seeded ({len(existing)} universities exist)"}

    catalog_entries: set[str] = set()

    for uni_data in SEED_DATA:
        uni_id = str(uuid.uuid4())
        university = University(
            id=uni_id,
            code=uni_data["code"],
            name=uni_data["name"],
        )
        db.add(university)

        for college_data in uni_data.get("colleges", []):
            college_id = str(uuid.uuid4())
            college = College(
                id=college_id,
                code=college_data["code"],
                name=college_data["name"],
                duration_years=college_data.get("duration_years", 4),
                university_id=uni_id,
            )
            db.add(college)

            for dept_code, dept_name in college_data.get("departments", []):
                department = Department(
                    id=str(uuid.uuid4()),
                    code=dept_code,
                    name=dept_name,
                    college_id=college_id,
                )
                db.add(department)

                if dept_code not in catalog_entries:
                    catalog_entries.add(dept_code)
                    db.add(DepartmentCatalog(code=dept_code, name=dept_name))

    await db.commit()
    return {"message": f"Seeded {len(SEED_DATA)} universities with colleges and departments"}
