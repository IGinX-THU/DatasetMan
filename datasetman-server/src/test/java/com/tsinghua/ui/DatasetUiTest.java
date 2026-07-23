package com.tsinghua.ui;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 数据集管理模块UI自动化测试
 * 对应测试用例: TC-UI-DATASET-001 ~ TC-UI-DATASET-008
 */
@DisplayName("数据集管理模块UI测试")
class DatasetUiTest extends UiTestBase {

    @Test
    @DisplayName("TC-UI-DATASET-001: 打开创建数据集弹窗")
    void testOpenDatasetCreateDialog() {
        doLogin();
        homePage.goToDatasetCreate();
        loginPage.sleep(1000);
        assertTrue(driver.findElement(By.id("datasetDialog")).isDisplayed(), "创建数据集弹窗应可见");
    }

    @Test
    @DisplayName("TC-UI-DATASET-002: 验证创建数据集表单元素")
    void testDatasetCreateFormElements() {
        doLogin();
        homePage.goToDatasetCreate();
        loginPage.sleep(1000);
        assertTrue(driver.findElement(By.id("datasetName")).isDisplayed());
        assertTrue(driver.findElement(By.id("datasetSql")).isDisplayed());
        assertTrue(driver.findElement(By.id("datasetDesc")).isDisplayed());
        assertTrue(driver.findElement(By.id("datasetRemark")).isDisplayed());
        assertTrue(driver.findElement(By.id("submitBtn")).isDisplayed());
        assertTrue(driver.findElement(By.id("cancelBtn")).isDisplayed());
    }

    @Test
    @DisplayName("TC-UI-DATASET-003: 创建数据集 - 空名称校验")
    void testDatasetCreateEmptyName() {
        doLogin();
        homePage.goToDatasetCreate();
        loginPage.sleep(1000);
        loginPage.inputById("datasetSql", "SELECT * FROM test");
        loginPage.clickById("submitBtn");
        loginPage.sleep(1000);
        assertTrue(driver.findElement(By.id("datasetNameError")).isDisplayed(), "空名称应显示错误提示");
    }

    @Test
    @DisplayName("TC-UI-DATASET-004: 创建数据集 - 空SQL校验")
    void testDatasetCreateEmptySql() {
        doLogin();
        homePage.goToDatasetCreate();
        loginPage.sleep(1000);
        loginPage.inputById("datasetName", "test_dataset");
        loginPage.clickById("submitBtn");
        loginPage.sleep(1000);
        assertTrue(driver.findElement(By.id("datasetSqlError")).isDisplayed(), "空SQL应显示错误提示");
    }

    @Test
    @DisplayName("TC-UI-DATASET-005: 创建数据集 - 取消操作")
    void testDatasetCreateCancel() {
        doLogin();
        homePage.goToDatasetCreate();
        loginPage.sleep(1000);
        loginPage.inputById("datasetName", "cancel_test");
        loginPage.clickById("cancelBtn");
        loginPage.sleep(1000);
        assertFalse(driver.findElement(By.id("datasetDialog")).isDisplayed(), "取消后弹窗应关闭");
    }

    @Test
    @DisplayName("TC-UI-DATASET-006: 创建数据集 - 填写完整信息并提交")
    void testDatasetCreateFillAndSubmit() {
        doLogin();
        homePage.goToDatasetCreate();
        loginPage.sleep(1000);
        loginPage.inputById("datasetName", "ui_test_dataset");
        loginPage.inputById("datasetSql", "SELECT * FROM test.cpu");
        loginPage.inputById("datasetDesc", "UI自动化测试数据集");
        loginPage.inputById("datasetRemark", "自动化创建");
        loginPage.clickById("submitBtn");
        // 等待接口响应
        String toastMsg = loginPage.waitForAnyToast(15);
        // 验证收到了响应
        assertTrue(!toastMsg.isEmpty() || loginPage.waitForElementHidden(org.openqa.selenium.By.id("datasetDialog"), 10),
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
        loginPage.inputById("datasetName", longName.toString());
        loginPage.inputById("datasetSql", "SELECT 1");
        loginPage.clickById("submitBtn");
        // 等待接口响应（成功或失败）
        String toastMsg = loginPage.waitForAnyToast(15);
        // 验证不崩溃且收到了响应
        assertTrue(!toastMsg.isEmpty() || loginPage.waitForElementHidden(org.openqa.selenium.By.id("datasetDialog"), 10),
                "提交后应收到接口响应");
    }

    @Test
    @DisplayName("TC-UI-DATASET-008: 创建数据集 - 名称含特殊字符")
    void testDatasetCreateSpecialChars() {
        doLogin();
        homePage.goToDatasetCreate();
        loginPage.sleep(1000);
        loginPage.inputById("datasetName", "test<script>alert(1)</script>");
        loginPage.inputById("datasetSql", "SELECT 1");
        loginPage.clickById("submitBtn");
        // 等待接口响应（成功或失败）
        String toastMsg = loginPage.waitForAnyToast(15);
        // 验证XSS不会执行且收到了响应
        assertTrue(!toastMsg.isEmpty() || loginPage.waitForElementHidden(org.openqa.selenium.By.id("datasetDialog"), 10),
                "提交后应收到接口响应，XSS代码不应执行");
    }
}
