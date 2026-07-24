package com.tsinghua.ui;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.WebElement;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 数据集管理模块UI自动化测试
 * 对应测试用例: TC-UI-DATASET-001 ~ TC-UI-DATASET-008
 */
@DisplayName("数据集管理模块UI测试")
class DatasetUiTest extends UiTestBase {

    private static final String HOST_DIALOG = "dataset-dialog";

    private void inputSql(String sql) {
        java.util.List<WebElement> textareas = loginPage.findsInShadow(HOST_DIALOG, ".sql-textarea");
        if (textareas.isEmpty()) {
            loginPage.clickInShadowById(HOST_DIALOG, "addSqlBtn");
            loginPage.sleep(300);
            textareas = loginPage.findsInShadow(HOST_DIALOG, ".sql-textarea");
        }
        WebElement sqlTextarea = textareas.get(0);
        sqlTextarea.clear();
        sqlTextarea.sendKeys(sql);
    }

    @Test
    @DisplayName("TC-UI-DATASET-001: 打开创建数据集弹窗")
    void testOpenDatasetCreateDialog() {
        doLogin();
        homePage.goToDatasetCreate();
        loginPage.sleep(1000);
        assertFalse(loginPage.isShadowHostHidden(HOST_DIALOG), "创建数据集弹窗应可见");
    }

    @Test
    @DisplayName("TC-UI-DATASET-002: 验证创建数据集表单元素")
    void testDatasetCreateFormElements() {
        doLogin();
        homePage.goToDatasetCreate();
        loginPage.sleep(1000);
        assertTrue(loginPage.findInShadowById(HOST_DIALOG, "datasetName").isDisplayed());
        assertTrue(loginPage.findInShadowById(HOST_DIALOG, "datasetRemark").isDisplayed());
        assertTrue(loginPage.findInShadowById(HOST_DIALOG, "addSqlBtn").isDisplayed());
        assertTrue(loginPage.findInShadowById(HOST_DIALOG, "submitBtn").isDisplayed());
        assertTrue(loginPage.findInShadowById(HOST_DIALOG, "cancelBtn").isDisplayed());
    }

    @Test
    @DisplayName("TC-UI-DATASET-003: 创建数据集 - 空名称校验")
    void testDatasetCreateEmptyName() {
        doLogin();
        homePage.goToDatasetCreate();
        loginPage.sleep(1000);
        inputSql("SELECT * FROM test");
        loginPage.clickInShadowById(HOST_DIALOG, "submitBtn");
        loginPage.sleep(1000);
        WebElement resultArea = loginPage.findInShadowById(HOST_DIALOG, "resultArea");
        assertTrue(resultArea.getText().contains("数据集名称"), "空名称应在结果区域显示错误提示");
    }

    @Test
    @DisplayName("TC-UI-DATASET-004: 创建数据集 - 空SQL校验")
    void testDatasetCreateEmptySql() {
        doLogin();
        homePage.goToDatasetCreate();
        loginPage.sleep(1000);
        loginPage.inputInShadowById(HOST_DIALOG, "datasetName", "test_dataset");
        loginPage.clickInShadowById(HOST_DIALOG, "submitBtn");
        loginPage.sleep(1000);
        WebElement resultArea = loginPage.findInShadowById(HOST_DIALOG, "resultArea");
        assertTrue(resultArea.getText().contains("SQL"), "空SQL应在结果区域显示错误提示");
    }

    @Test
    @DisplayName("TC-UI-DATASET-005: 创建数据集 - 取消操作")
    void testDatasetCreateCancel() {
        doLogin();
        homePage.goToDatasetCreate();
        loginPage.sleep(1000);
        loginPage.inputInShadowById(HOST_DIALOG, "datasetName", "cancel_test");
        loginPage.clickInShadowById(HOST_DIALOG, "cancelBtn");
        loginPage.sleep(1000);
        assertTrue(loginPage.isShadowHostHidden(HOST_DIALOG), "取消后弹窗应关闭");
    }

    @Test
    @DisplayName("TC-UI-DATASET-006: 创建数据集 - 填写完整信息并提交")
    void testDatasetCreateFillAndSubmit() {
        doLogin();
        homePage.goToDatasetCreate();
        loginPage.sleep(1000);
        loginPage.inputInShadowById(HOST_DIALOG, "datasetName", "ui_test_dataset");
        inputSql("SELECT * FROM test.cpu");
        loginPage.inputInShadowById(HOST_DIALOG, "datasetRemark", "自动化创建");
        loginPage.clickInShadowById(HOST_DIALOG, "submitBtn");
        // 等待接口响应
        String toastMsg = loginPage.waitForAnyToast(15);
        // 验证收到了响应
        assertTrue(!toastMsg.isEmpty() || loginPage.isShadowHostHidden(HOST_DIALOG),
                "提交后应收到接口响应（Toast提示或弹窗关闭）");
    }

    @Test
    @DisplayName("TC-UI-DATASET-007: 创建数据集 - 超长名称边界测试")
    void testDatasetCreateLongName() {
        doLogin();
        homePage.goToDatasetCreate();
        loginPage.sleep(1000);
        StringBuilder longName = new StringBuilder();
        for (int i = 0; i < 200; i++) { longName.append("d"); }
        loginPage.inputInShadowById(HOST_DIALOG, "datasetName", longName.toString());
        inputSql("SELECT 1");
        loginPage.clickInShadowById(HOST_DIALOG, "submitBtn");
        loginPage.sleep(1000);
        // 前端校验应拒绝超长名称并提示错误
        WebElement resultArea = loginPage.findInShadowById(HOST_DIALOG, "resultArea");
        assertTrue(resultArea.getText().contains("50"), "超长名称应被前端校验拒绝，提示长度不能超过50个字符");
    }

    @Test
    @DisplayName("TC-UI-DATASET-008: 创建数据集 - 名称含特殊字符")
    void testDatasetCreateSpecialChars() {
        doLogin();
        homePage.goToDatasetCreate();
        loginPage.sleep(1000);
        loginPage.inputInShadowById(HOST_DIALOG, "datasetName", "test<script>alert(1)</script>");
        inputSql("SELECT 1");
        loginPage.clickInShadowById(HOST_DIALOG, "submitBtn");
        loginPage.sleep(1000);
        // 名称含特殊字符，前端校验应拒绝并提示错误
        WebElement resultArea = loginPage.findInShadowById(HOST_DIALOG, "resultArea");
        assertTrue(resultArea.getText().contains("字母"), "特殊字符名称应被校验拒绝并提示错误");
    }
}
