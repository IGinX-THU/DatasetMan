package com.tsinghua.ui;

import org.openqa.selenium.WebDriver;

/**
 * 首页 Page Object - 主导航和通用操作
 */
public class HomePage extends BasePage {

    public HomePage(WebDriver driver) {
        super(driver);
    }

    public boolean isHomePage() {
        return !isLoginPage();
    }

    public String getDisplayedUsername() {
        return findById("username").getText();
    }

    public void logout() {
        clickById("logoutBtn");
        sleep(1000);
    }

    // ============ 导航操作 ============
    public void goToDataSourceManagement() {
        clickDropdownMenuItem("dataSourceDropdown", "menu-data-source-management");
    }

    public void goToRegisterDataSource() {
        clickDropdownMenuItem("dataSourceDropdown", "menu-register-heterogeneous-data-source");
    }

    public void goToDatasetCreate() {
        clickDropdownMenuItem("datasetDropdown", "menu-dataset-create");
    }

    public void goToJobOrchestration() {
        clickDropdownMenuItem("jobDropdown", "menu-job-orchestration");
    }

    public void goToJobManagement() {
        clickDropdownMenuItem("jobDropdown", "menu-job-management");
    }

    public void goToTransformManagement() {
        clickDropdownMenuItem("functionDropdown", "menu-transform-management");
    }

    public void goToUdfManagement() {
        clickDropdownMenuItem("functionDropdown", "menu-udf-management");
    }

    public void goToEvaluationCriteria() {
        clickDropdownMenuItem("qualityDropdown", "menu-evaluation-criteria");
    }

    public void goToQualityAssessment() {
        clickDropdownMenuItem("qualityDropdown", "menu-quality-assessment");
    }

    public void goToUserManagement() {
        clickDropdownMenuItem("userDropdown", "userManagementMenuItem");
    }

    public void goToPermissionManagement() {
        clickDropdownMenuItem("userDropdown", "permissionManagementMenuItem");
    }

    public void goToChangePassword() {
        clickDropdownMenuItem("userDropdown", "changePasswordMenuItem");
    }
}
