# GerakBijak

**Move smarter, beat the rush.** GerakBijak ("move wisely" in Malay) helps township commuters pick a better time to leave, share school runs with neighbours. It has two parts: a resident app for commuters and an admin dashboard for township managers.

## The problem

Morning traffic in townships peaks because everyone leaves at the same time, and many families drive separately to the same school. Shifting a few minutes earlier or sharing a ride can cut travel time for everyone, but there is little incentive to change habits.

## The solution

GerakBijak nudges commuters to leave in a less congested slot and matches nearby families for school-run carpools.

## Features

### Today
- Choose your **origin**, **destination** and the time you **usually leave**.
- Get a **suggested departure time** (within 20 minutes before your usual time) with the predicted trip duration.
- See how many minutes you **save** compared with leaving at your usual time.
- View a **morning rush indicator** and a bar chart comparing trip times around your usual slot.
- One tap to open the route in **Waze** or **Google Maps**.
- Tap **"I'm leaving now"**

### Carpool
- Suggested **school-run group** of nearby households (e.g. SK Denai Alam, 7:20 drop-off).
- Weekly **driving rota** and impact summary (cars off the road, points per shared run).
- **Privacy first:** only distance is shown; house and phone numbers are shared after every family accepts.
- Request to join or cancel a group.

### Profile
- Save your **home, school and workplace** so routes and usual departure times are pre-filled.
- Manage **household details**

### Admin dashboard
A single-screen overview of weekday morning traffic for the township.

- KPIs: households taking part, average time saved per household, cars removed at peak, and estimated monthly CO2 avoided.
- Exit traffic chart: cars leaving per 5 minutes at each exit (GCE Elmina interchange and Persiaran Elmina to Subang), comparing Before and After GerakBijak against the exit's capacity line. Toggle between Both, Before and After.
- Morning rush by route: predicted rush window, early-leave trip time, worst trip time and how much the rush adds, for each destination from Elmina East.
- Exit status: busiest 5-minute load against capacity, labelled Flowing, Near limit or Over limit.
- School-run carpools: carpool groups and cars removed per school.
Can leave earlier, by precinct: share of residents in each precinct willing to shift.
- Residents: newest sign-ups or the full list, showing whether each joined through the app or the survey.
- Refreshes automatically every 15 seconds when the resident API is available.


## Getting started

The app loads `data/gerakbijak_data.json` with `fetch`, so it must be served over HTTP. Opening `app.html` directly from the file system will not work.

```bash
# clone the repo
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>

# start a local server (pick one)
python3 -m http.server 8000
# or
npx serve .
```

Then open <http://localhost:8000/app.html> in your browser. For the best experience, use your browser's mobile view (the layout is designed for a 430 px wide screen).


### How the suggestion works

For the chosen usual departure time, the app checks every slot up to 20 minutes earlier and picks the one with the shortest predicted trip. The difference from the usual slot is shown as time saved.

## Prototype notes

This is a hackathon prototype. The following are currently simulated on the client side and are not saved between sessions:

- Carpool matching, neighbours and the weekly rota
- Points, activity history and voucher redemption
- Trip predictions come from a static dataset rather than live traffic

## Team

| Name | Role |
|---|---|
| Amy Safira | Project Leader |
| Aliya Syakira |  
| Izyan Khaleeda |
