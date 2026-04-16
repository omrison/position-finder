build a simple web app that 

the app will 

1. present the ability to upload a cv 
2. show the user a checkbox with 10 regions in Israel, covering all Israel areas. \[Insert preferred location, e.g.: Tel Aviv / Ramat Gan] also include "Remote" for remote jobs
3. present a timeframe comobox with multiselection for the last 24 hours, 48 hours, week

&#x20;

Using a submit button, the app will show the jobs with the highest likelihood of being accepted—not just general fit.

it should find positions that match the skills and experience given in the uploaded cv according to the area selected and checked in the checkbox





Steps to perform:



1. Analyze the resume and understand:

• Core skills

• Relevant experience

• Seniority level

• Suitable role types



2\. Find jobs posted in the last timeframe (default is 24 hours) from sources such as:

• LinkedIn

• Google

• Relevant job boards in Israel



3\. For each job:

• Calculate a match score out of 10 based on:

Role fit, responsibilities, skills, experience, and seniority



Required output (only):



Display a table order capabilities and the following columns:

Role | Company | Posting Date | Source | Match Score | Application Link





Rules:

• Include only jobs from the last timeframe selected by the user

• Return only jobs with a match score of 7 or higher

• Limit to 100 jobs only

• Sort by:



Most recent

Highest match score

• Be strict with scoring (no inflation)





