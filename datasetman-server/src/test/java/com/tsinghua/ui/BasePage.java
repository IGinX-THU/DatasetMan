package com.tsinghua.ui;

import org.openqa.selenium.*;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.Select;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.openqa.selenium.interactions.Actions;

import java.time.Duration;
import java.util.List;

/**
 * 页面基类 - 所有Page Object的父类，封装常用WebDriver操作
 */
public abstract class BasePage {

    protected final WebDriver driver;
    protected final WebDriverWait wait;
    protected final Actions actions;

    public BasePage(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
        this.actions = new Actions(driver);
    }

    // ============ 元素查找 ============
    public WebElement find(By by) {
        return driver.findElement(by);
    }

    public List<WebElement> finds(By by) {
        return driver.findElements(by);
    }

    public WebElement findById(String id) {
        return find(By.id(id));
    }

    public WebElement findByCss(String css) {
        return find(By.cssSelector(css));
    }

    public WebElement findByXpath(String xpath) {
        return find(By.xpath(xpath));
    }

    public WebElement findByText(String text) {
        return findByXpath("//*[contains(text(),'" + text + "')]");
    }

    // ============ 等待 ============
    public WebElement waitForVisible(By by) {
        return wait.until(ExpectedConditions.visibilityOfElementLocated(by));
    }

    public WebElement waitForVisible(By by, int timeoutSeconds) {
        return new WebDriverWait(driver, Duration.ofSeconds(timeoutSeconds))
                .until(ExpectedConditions.visibilityOfElementLocated(by));
    }

    public WebElement waitForClickable(By by) {
        return wait.until(ExpectedConditions.elementToBeClickable(by));
    }

    public WebElement waitForClickable(WebElement element) {
        return wait.until(ExpectedConditions.elementToBeClickable(element));
    }

    public WebElement waitForPresence(By by) {
        return wait.until(ExpectedConditions.presenceOfElementLocated(by));
    }

    public boolean waitForHidden(By by) {
        return wait.until(ExpectedConditions.invisibilityOfElementLocated(by));
    }

    public void waitForUrlChange(String oldUrlFragment) {
        wait.until(driver -> !driver.getCurrentUrl().contains(oldUrlFragment));
    }

    // ============ 输入操作 ============
    public void inputText(WebElement element, String text) {
        element.clear();
        element.sendKeys(text);
    }

    public void inputById(String id, String text) {
        inputText(findById(id), text);
    }

    // ============ 点击操作 ============
    public void click(WebElement element) {
        waitForClickable(element);
        element.click();
    }

    public void clickById(String id) {
        click(findById(id));
    }

    public void clickByCss(String css) {
        click(findByCss(css));
    }

    // ============ 下拉选择 ============
    public void selectByValue(String selectId, String value) {
        new Select(findById(selectId)).selectByValue(value);
    }

    public void selectByVisibleText(String selectId, String text) {
        new Select(findById(selectId)).selectByVisibleText(text);
    }

    // ============ 模态框操作 ============
    public WebElement waitForModal(String modalId) {
        return waitForVisible(By.id(modalId));
    }

    // ============ 表格操作 ============
    public List<WebElement> getTableRows(String tableBodyId) {
        return findById(tableBodyId).findElements(By.tagName("tr"));
    }

    public int getRowCount(String tableBodyId) {
        return getTableRows(tableBodyId).size();
    }

    public List<WebElement> getTableHeaders(String componentId) {
        return findByCss("#" + componentId + " th").findElements(By.xpath(".."))
                .get(0).findElements(By.tagName("th"));
    }

    // ============ 菜单导航 ============
    public void hoverDropdown(String dropdownId) {
        actions.moveToElement(findById(dropdownId)).perform();
        sleep(500);
    }

    // ============ 工具方法 ============
    public void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    public String getCurrentUrl() {
        return driver.getCurrentUrl();
    }

    public boolean isLoginPage() {
        return getCurrentUrl().contains("login.html");
    }

    public void takeScreenshot(String name) {
        try {
            byte[] screenshot = ((TakesScreenshot) driver).getScreenshotAs(OutputType.BYTES);
            io.qameta.allure.Allure.addAttachment(name, "image/png",
                    new java.io.ByteArrayInputStream(screenshot), ".png");
        } catch (Exception e) {
            // ignore screenshot failures
        }
    }

    public Object executeJs(String script, Object... args) {
        return ((JavascriptExecutor) driver).executeScript(script, args);
    }
}
