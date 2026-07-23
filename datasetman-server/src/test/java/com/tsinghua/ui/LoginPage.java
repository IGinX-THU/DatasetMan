package com.tsinghua.ui;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

/**
 * 登录页面 Page Object
 */
public class LoginPage extends BasePage {

    private static final By USERNAME_INPUT = By.id("username");
    private static final By PASSWORD_INPUT = By.id("password");
    private static final By LOGIN_BTN = By.id("loginBtn");
    private static final By ERROR_MESSAGE = By.id("errorMessage");

    public LoginPage(WebDriver driver) {
        super(driver);
    }

    public void login(String username, String password) {
        WebElement usernameInput = waitForVisible(USERNAME_INPUT);
        inputText(usernameInput, username);
        inputText(find(PASSWORD_INPUT), password);
        click(find(LOGIN_BTN));
    }

    public String getErrorMessage() {
        try {
            WebElement errorEl = find(ERROR_MESSAGE);
            if (errorEl.isDisplayed()) {
                return errorEl.getText();
            }
        } catch (Exception e) {
            // ignore
        }
        return "";
    }

    public boolean isLoginBtnEnabled() {
        return find(LOGIN_BTN).isEnabled();
    }

    public void clearInputs() {
        find(USERNAME_INPUT).clear();
        find(PASSWORD_INPUT).clear();
    }

    public void clickLoginBtn() {
        click(find(LOGIN_BTN));
    }

    public void inputUsername(String username) {
        inputText(find(USERNAME_INPUT), username);
    }

    public void inputPassword(String password) {
        inputText(find(PASSWORD_INPUT), password);
    }
}
