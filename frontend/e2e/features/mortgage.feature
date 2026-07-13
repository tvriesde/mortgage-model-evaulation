Feature: Mortgage pre-assessment wizard
  As a first-time home buyer
  I want to complete a short mortgage wizard
  So that I get a preliminary decision from the bank's agent

  Background:
    Given I am on the Huisje home page

  Scenario: Approved mortgage for a comfortable permanent-income request
    When I enter my income details with a permanent contract earning 50000 buying a 250000 home borrowing 200000
    And I continue to the personal step
    And I enter my age as 30
    And the agent will respond with verdict "approved"
    And I submit the mortgage check
    Then I see a result with verdict "approved"

  Scenario: Declined mortgage when borrowing more than the home is worth
    When I enter my income details with a permanent contract earning 50000 buying a 180000 home borrowing 200000
    And I continue to the personal step
    And I enter my age as 30
    And the agent will respond with verdict "declined"
    And I submit the mortgage check
    Then I see a result with verdict "declined"

  Scenario: Needs review for a temporary contract
    When I enter my income details with a temporary contract earning 50000 buying a 250000 home borrowing 200000
    And I continue to the personal step
    And I enter my age as 30
    And the agent will respond with verdict "needs_review"
    And I submit the mortgage check
    Then I see a result with verdict "needs_review"

  Scenario: Validation blocks progress when money fields are empty
    When I continue to the personal step without entering income details
    Then I stay on the income step and see a validation error

  Scenario: The user can go back and change their answers
    When I enter my income details with a permanent contract earning 50000 buying a 250000 home borrowing 200000
    And I continue to the personal step
    And I go back to the income step
    Then I see my previously entered income of 50000
