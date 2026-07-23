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
        hoverDropdown("dataSourceDropdown");
        clickById("menu-data-source-management");
        sleep(1000);
    }

    public void goToRegisterDataSource() {
        hoverDropdown("dataSourceDropdown");
        clickById("menu-register-heterogeneous-data-source");
        sleep(1000);
    }

    public void goToDatasetCreate() {
        hoverDropdown("datasetDropdown");
        clickById("menu-dataset-create");
        sleep(1000);
    }

    public void goToJobOrchestration() {
        hoverDropdown("jobDropdown");
        clickById("menu-job-orchestration");
        sleep(1000);
    }

    public void goToJobManagement() {
        hoverDropdown("jobDropdown");
        clickById("menu-job-management");
        sleep(1000);
    }

    public void goToTransformManagement() {
        hoverDropdown("functionDropdown");
        clickById("menu-transform-management");
        sleep(1000);
    }

    public void goToUdfManagement() {
        hoverDropdown("functionDropdown");
        clickById("menu-udf-management");
        sleep(1000);
    }

    public void goToEvaluationCriteria() {
        hoverDropdown("qualityDropdown");
        clickById("menu-evaluation-criteria");
        sleep(1000);
    }

    public void goToQualityAssessment() {
        hoverDropdown("qualityDropdown");
        clickById("menu-quality-assessment");
        sleep(1000);
    }

    public void goToUserManagement() {
        hoverDropdown("userDropdown");
        clickById("userManagementMenuItem");
        sleep(1000);
    }

    public void goToPermissionManagement() {
        hoverDropdown("userDropdown");
        clickById("permissionManagementMenuItem");
        sleep(1000);
    }

    public void goToChangePassword() {
        hoverDropdown("userDropdown");
        clickById("changePasswordMenuItem");
        sleep(1000);
    }
}
