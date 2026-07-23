package com.tsinghua.ui;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.Select;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 函数管理模块（Transform/UDF）UI自动化测试
 * 对应测试用例: TC-UI-FUNC-001 ~ TC-UI-FUNC-011
 */
@DisplayName("函数管理模块UI测试")
class FunctionUiTest extends UiTestBase {

    @Nested
    @DisplayName("Transform托管")
    class TransformManagement {

        @Test
        @DisplayName("TC-UI-FUNC-001: 打开Transform托管页面")
        void testOpenTransformManagement() {
            doLogin();
            homePage.goToTransformManagement();
            loginPage.sleep(1000);
            assertTrue(driver.findElement(By.id("transformManagement")).isDisplayed(), "Transform管理组件应可见");
        }

        @Test
        @DisplayName("TC-UI-FUNC-002: 验证Transform列表表头")
        void testTransformListTableHeaders() {
            doLogin();
            homePage.goToTransformManagement();
            loginPage.sleep(1000);
            List<WebElement> headers = driver.findElements(By.cssSelector("#transformManagement th"));
            List<String> texts = new ArrayList<>();
            for (WebElement h : headers) { texts.add(h.getText()); }
            assertTrue(texts.contains("Transform别名"));
            assertTrue(texts.contains("类名"));
            assertTrue(texts.contains("脚本文件名"));
        }

        @Test
        @DisplayName("TC-UI-FUNC-003: 打开注册Transform弹窗")
        void testOpenRegisterTransformModal() {
            doLogin();
            homePage.goToTransformManagement();
            loginPage.sleep(1000);
            loginPage.clickById("registerTransformBtn");
            loginPage.sleep(1000);
            assertTrue(driver.findElement(By.id("modalMask")).isDisplayed(), "注册Transform弹窗应可见");
        }

        @Test
        @DisplayName("TC-UI-FUNC-004: 验证注册Transform表单元素")
        void testRegisterTransformFormElements() {
            doLogin();
            homePage.goToTransformManagement();
            loginPage.sleep(1000);
            loginPage.clickById("registerTransformBtn");
            loginPage.sleep(1000);
            assertTrue(driver.findElement(By.id("transformName")).isDisplayed());
            assertTrue(driver.findElement(By.id("className")).isDisplayed());
            assertTrue(driver.findElement(By.id("transformFile")).isDisplayed());
            assertTrue(driver.findElement(By.id("saveBtn")).isDisplayed());
            assertTrue(driver.findElement(By.id("cancelBtn")).isDisplayed());
        }

        @Test
        @DisplayName("TC-UI-FUNC-005: 注册Transform - 空别名校验")
        void testRegisterTransformEmptyName() {
            doLogin();
            homePage.goToTransformManagement();
            loginPage.sleep(1000);
            loginPage.clickById("registerTransformBtn");
            loginPage.sleep(1000);
            loginPage.clickById("saveBtn");
            loginPage.sleep(1000);
            assertTrue(driver.findElement(By.id("modalMask")).isDisplayed(), "空别名应阻止提交");
        }

        @Test
        @DisplayName("TC-UI-FUNC-006: 注册Transform - 取消操作")
        void testRegisterTransformCancel() {
            doLogin();
            homePage.goToTransformManagement();
            loginPage.sleep(1000);
            loginPage.clickById("registerTransformBtn");
            loginPage.sleep(1000);
            loginPage.clickById("cancelBtn");
            loginPage.sleep(1000);
            assertFalse(driver.findElement(By.id("modalMask")).isDisplayed(), "取消后弹窗应关闭");
        }

        @Test
        @DisplayName("TC-UI-FUNC-007: 刷新Transform列表")
        void testTransformRefresh() {
            doLogin();
            homePage.goToTransformManagement();
            loginPage.sleep(1000);
            loginPage.clickById("refreshBtn");
            loginPage.sleep(2000);
            assertTrue(driver.findElement(By.id("tableBody")).isDisplayed());
        }
    }

    @Nested
    @DisplayName("UDF托管")
    class UdfManagement {

        @Test
        @DisplayName("TC-UI-FUNC-008: 打开UDF托管页面")
        void testOpenUdfManagement() {
            doLogin();
            homePage.goToUdfManagement();
            loginPage.sleep(1000);
            assertTrue(driver.findElement(By.id("udfManagement")).isDisplayed(), "UDF管理组件应可见");
        }

        @Test
        @DisplayName("TC-UI-FUNC-009: 打开注册UDF弹窗")
        void testOpenRegisterUdfModal() {
            doLogin();
            homePage.goToUdfManagement();
            loginPage.sleep(1000);
            loginPage.clickById("registerUdfBtn");
            loginPage.sleep(1000);
            assertTrue(driver.findElement(By.id("udfModal")).isDisplayed(), "注册UDF弹窗应可见");
        }

        @Test
        @DisplayName("TC-UI-FUNC-010: 验证注册UDF表单元素")
        void testRegisterUdfFormElements() {
            doLogin();
            homePage.goToUdfManagement();
            loginPage.sleep(1000);
            loginPage.clickById("registerUdfBtn");
            loginPage.sleep(1000);
            assertTrue(driver.findElement(By.id("udfType")).isDisplayed());
            assertTrue(driver.findElement(By.id("udfName")).isDisplayed());
            assertTrue(driver.findElement(By.id("className")).isDisplayed());
            assertTrue(driver.findElement(By.id("udfFile")).isDisplayed());
        }

        @Test
        @DisplayName("TC-UI-FUNC-011: 验证UDF类型下拉选项")
        void testRegisterUdfTypeOptions() {
            doLogin();
            homePage.goToUdfManagement();
            loginPage.sleep(1000);
            loginPage.clickById("registerUdfBtn");
            loginPage.sleep(1000);
            Select typeSelect = new Select(driver.findElement(By.id("udfType")));
            List<String> options = new ArrayList<>();
            for (WebElement o : typeSelect.getOptions()) { options.add(o.getAttribute("value")); }
            assertTrue(options.contains("UDAF"), "应包含UDAF选项");
            assertTrue(options.contains("UDTF"), "应包含UDTF选项");
            assertTrue(options.contains("UDSF"), "应包含UDSF选项");
        }
    }
}
