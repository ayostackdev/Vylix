import { Injectable, Logger, Module, OnModuleInit } from '@nestjs/common';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
class ColphysSeedService implements OnModuleInit {
	private readonly logger = new Logger(ColphysSeedService.name);

	constructor(private readonly prisma: PrismaService) {}

	async onModuleInit() {
		const college = await this.prisma.college.upsert({
			where: { code: 'COLPHY' },
			update: {
				name: 'College of Physics',
				durationYears: 4
			},
			create: {
				code: 'COLPHY',
				name: 'College of Physics',
				durationYears: 4
			}
		});

		const departments = [
			{ code: 'PHYS', name: 'Department of Physics' },
			{ code: 'CHEM', name: 'Department of Chemistry' },
			{ code: 'MATH', name: 'Department of Mathematics' },
			{ code: 'STAT', name: 'Department of Statistics' }
		];

		await Promise.all(
			departments.map((department) =>
				this.prisma.department.upsert({
					where: { code: department.code },
					update: {
						name: department.name,
						collegeId: college.id
					},
					create: {
						code: department.code,
						name: department.name,
						collegeId: college.id
					}
				})
			)
		);

		this.logger.log('Seeded COLPHY departments: Physics, Chemistry, Mathematics, Statistics.');
	}
}

@Module({
	imports: [PrismaModule],
	providers: [ColphysSeedService]
})
export class ColphysModule {}
