import { Component, OnInit } from '@angular/core';
import {
	Employee,
	Organization,
	OrganizationContact,
	OrganizationProjects,
	OrganizationProjectsCreateInput,
	PermissionsEnum,
	ComponentLayoutStyleEnum
} from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { first, takeUntil } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { Store } from '../../@core/services/store.service';
import { OrganizationContactService } from '../../@core/services/organization-contact.service';
import { OrganizationProjectsService } from '../../@core/services/organization-projects.service';
import { EmployeesService } from '../../@core/services';
import { ComponentEnum } from '../../@core/constants/layout.constants';

@Component({
	selector: 'ga-projects',
	templateUrl: './projects.component.html',
	styleUrls: ['./projects.component.scss']
})
export class ProjectsComponent extends TranslationBaseComponent
	implements OnInit {
	private _ngDestroy$ = new Subject<void>();

	organization: Organization;
	showAddCard: boolean;
	projects: OrganizationProjects[];
	organizationContacts: OrganizationContact[];
	employees: Employee[] = [];
	projectToEdit: OrganizationProjects;
	viewPrivateProjects: boolean;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;

	constructor(
		private readonly organizationContactService: OrganizationContactService,
		private readonly organizationProjectsService: OrganizationProjectsService,
		private readonly toastrService: NbToastrService,
		private store: Store,
		private readonly employeesService: EmployeesService,
		readonly translateService: TranslateService,
		private route: ActivatedRoute
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				if (organization) {
					this.organization = organization;
					this.loadProjects();
					this.loadEmployees();
					this.loadOrganizationContacts();
				}
			});
		this.store.userRolePermissions$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.viewPrivateProjects = this.store.hasPermission(
					PermissionsEnum.ACCESS_PRIVATE_PROJECTS
				);
			});

		this.route.queryParamMap
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((params) => {
				if (params.get('openAddDialog')) {
					this.showAddCard = !this.showAddCard;
					this.loadProjects();
				}
			});
	}

	private async loadEmployees() {
		if (!this.organization) {
			return;
		}

		const { items } = await this.employeesService
			.getAll(['user'], { organization: { id: this.organization.id } })
			.pipe(first())
			.toPromise();

		this.employees = items;
	}
	setView() {
		this.viewComponentName = ComponentEnum.PROJECTS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
	}
	async removeProject(id: string, name: string) {
		await this.organizationProjectsService.delete(id);

		this.toastrService.primary(
			this.getTranslation(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.REMOVE_PROJECT',
				{
					name: name
				}
			),
			this.getTranslation('TOASTR.TITLE.SUCCESS')
		);

		this.loadProjects();
	}

	cancel() {
		this.projectToEdit = null;
		this.showAddCard = !this.showAddCard;
	}

	private async addOrEditProject({
		action,
		project
	}: {
		action: 'add' | 'edit';
		project: OrganizationProjectsCreateInput;
	}) {
		switch (action) {
			case 'add':
				if (project.name) {
					await this.organizationProjectsService.create(project);
				} else {
					this.toastrService.danger(
						this.getTranslation(
							'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.INVALID_PROJECT_NAME'
						),
						this.getTranslation(
							'TOASTR.MESSAGE.NEW_ORGANIZATION_PROJECT_INVALID_NAME'
						)
					);
				}
				break;

			case 'edit':
				await this.organizationProjectsService.edit(project);
				break;
		}

		this.toastrService.primary(
			this.getTranslation(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.ADD_PROJECT',
				{
					name: project.name
				}
			),
			this.getTranslation('TOASTR.TITLE.SUCCESS')
		);

		this.projectToEdit = null;
		this.showAddCard = !this.showAddCard;
		this.loadProjects();
	}

	private async loadProjects() {
		if (!this.organization) {
			return;
		}

		const res = await this.organizationProjectsService.getAll(
			['organizationContact', 'members', 'members.user', 'tags'],
			{
				organizationId: this.organization.id
			}
		);
		if (res) {
			const canView = [];
			if (this.viewPrivateProjects) {
				this.projects = res.items;
			} else {
				res.items.forEach((item) => {
					if (item.public) {
						canView.push(item);
					} else {
						item.members.forEach((member) => {
							if (member.id === this.store.userId) {
								canView.push(item);
							}
						});
					}
				});
				this.projects = canView;
			}
		}
	}

	private async loadOrganizationContacts() {
		if (!this.organization) {
			return;
		}

		const res = await this.organizationContactService.getAll(['projects'], {
			organizationId: this.organization.id
		});
		if (res) {
			this.organizationContacts = res.items;
		}
	}

	async editProject(project: OrganizationProjects) {
		this.projectToEdit = project;
		this.showAddCard = true;
	}
}
