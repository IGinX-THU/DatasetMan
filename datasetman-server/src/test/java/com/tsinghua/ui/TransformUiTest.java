package com.tsinghua.ui;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Transform编排与任务管理模块UI自动化测试
 * 对应测试用例: TC-UI-TC-001 ~ TC-UI-TC-005, TC-UI-TJ-001 ~ TC-UI-TJ-006
 */
@DisplayName("Transform编排与任务管理模块UI测试")
class TransformUiTest extends UiTestBase {

    @Nested
    @DisplayName("Transform编排")
    class TransformCompare {

        @Test
        @DisplayName("TC-UI-TC-001: 打开Transform编排页面")
        void testOpenTransformCompare() {
            doLogin();
            homePage.goToJobOrchestration();
            loginPage.sleep(1000);
            assertTrue(driver.findElement(By.id("transformCompare")).isDisplayed(), "Transform编排组件应可见");
        }

        @Test
        @DisplayName("TC-UI-TC-002: 验证编排筛选区域元素")
        void testTransformCompareFilterElements() {
            doLogin();
            homePage.goToJobOrchestration();
            loginPage.sleep(1000);
            WebElement filterInput = driver.findElement(By.cssSelector("#transformCompare .filter-input"));
            assertTrue(filterInput.isDisplayed());
            assertTrue(driver.findElement(By.cssSelector("#transformCompare #applyFilters")).isDisplayed());
            assertTrue(driver.findElement(By.cssSelector("#transformCompare #resetFilters")).isDisplayed());
        }

        @Test
        @DisplayName("TC-UI-TC-003: 验证编排表格表头")
        void testTransformCompareTableHeaders() {
            doLogin();
            homePage.goToJobOrchestration();
            loginPage.sleep(1000);
            List<WebElement> headers = driver.findElements(By.cssSelector("#transformCompare th"));
            assertEquals(5, headers.size(), "编排表格应有5列表头");
            assertEquals("名称", headers.get(0).getText());
            assertEquals("导出文件名", headers.get(1).getText());
            assertEquals("调度策略", headers.get(2).getText());
            assertEquals("创建时间", headers.get(3).getText());
            assertEquals("操作", headers.get(4).getText());
        }

        @Test
        @DisplayName("TC-UI-TC-004: 点击新增按钮")
        void testTransformCompareAddBtn() {
            doLogin();
            homePage.goToJobOrchestration();
            loginPage.sleep(1000);
            WebElement addBtn = driver.findElement(By.cssSelector("#transformCompare #addJobBtn"));
            assertTrue(addBtn.isDisplayed());
            loginPage.click(addBtn);
            loginPage.sleep(1000);
            // 验证点击后有响应（弹窗或编辑界面出现）
            boolean modalAppeared = false;
            try {
                modalAppeared = driver.findElement(By.cssSelector("#transformCompare .dialog-mask, #transformCompare .modal")).isDisplayed();
            } catch (Exception ignored) {}
            assertTrue(modalAppeared, "点击新增按钮后应出现弹窗或编辑界面");
        }

        @Test
        @DisplayName("TC-UI-TC-005: 编排筛选并重置")
        void testTransformCompareFilterAndReset() {
            doLogin();
            homePage.goToJobOrchestration();
            loginPage.sleep(1000);
            WebElement filterInput = driver.findElement(By.cssSelector("#transformCompare .filter-input"));
            filterInput.clear();
            filterInput.sendKeys("test_job");
            loginPage.clickByCss("#transformCompare #applyFilters");
            // 等待表格刷新
            loginPage.waitForVisible(By.cssSelector("#transformCompare #tableBody"), 10);
            loginPage.clickByCss("#transformCompare #resetFilters");
            loginPage.sleep(1000);
            assertEquals("", filterInput.getAttribute("value"), "重置后筛选框应清空");
        }
    }

    @Nested
    @DisplayName("Transform任务管理")
    class TransformJob {

        @Test
        @DisplayName("TC-UI-TJ-001: 打开Transform任务管理页面")
        void testOpenTransformJob() {
            doLogin();
            homePage.goToJobManagement();
            loginPage.sleep(1000);
            assertTrue(driver.findElement(By.id("transformJob")).isDisplayed(), "Transform任务管理组件应可见");
        }

        @Test
        @DisplayName("TC-UI-TJ-002: 验证任务管理表格表头")
        void testTransformJobTableHeaders() {
            doLogin();
            homePage.goToJobManagement();
            loginPage.sleep(1000);
            List<WebElement> headers = driver.findElements(By.cssSelector("#transformJob th"));
            assertTrue(headers.size() > 0, "任务管理表格应有表头");
        }

        @Test
        @DisplayName("TC-UI-TJ-003: 验证任务管理筛选区域")
        void testTransformJobFilterElements() {
            doLogin();
            homePage.goToJobManagement();
            loginPage.sleep(1000);
            List<WebElement> filterInputs = driver.findElements(By.cssSelector("#transformJob .filter-input"));
            assertTrue(filterInputs.size() > 0, "应有筛选输入框");
        }

        @Test
        @DisplayName("TC-UI-TJ-004: 查询任务列表")
        void testTransformJobQuery() {
            doLogin();
            homePage.goToJobManagement();
            loginPage.sleep(1000);
            WebElement applyBtn = driver.findElement(By.cssSelector("#transformJob #applyFilters"));
            loginPage.click(applyBtn);
            // 等待表格刷新（接口返回数据后表格更新）
            loginPage.waitForVisible(By.cssSelector("#transformJob #tableBody"), 10);
            assertTrue(driver.findElement(By.cssSelector("#transformJob #tableBody")).isDisplayed(),
                    "查询后表格应可见");
        }

        @Test
        @DisplayName("TC-UI-TJ-005: 重置任务筛选条件")
        void testTransformJobResetFilter() {
            doLogin();
            homePage.goToJobManagement();
            loginPage.sleep(1000);
            WebElement resetBtn = driver.findElement(By.cssSelector("#transformJob #resetFilters"));
            loginPage.click(resetBtn);
            loginPage.sleep(1000);
            List<WebElement> filterInputs = driver.findElements(By.cssSelector("#transformJob .filter-input"));
            for (WebElement inp : filterInputs) {
                assertEquals("", inp.getAttribute("value"), "重置后筛选框应清空");
            }
        }

        @Test
        @DisplayName("TC-UI-TJ-006: 验证分页组件存在")
        void testTransformJobPagination() {
            doLogin();
            homePage.goToJobManagement();
            loginPage.sleep(1000);
            WebElement pagination = driver.findElement(By.cssSelector("#transformJob common-pagination"));
            assertTrue(pagination.isDisplayed(), "分页组件应可见");
        }
    }
}
