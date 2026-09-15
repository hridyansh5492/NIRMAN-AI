"""Deterministic mock map data for the NIRMAN-AI interactive project map.

The live ``project_monitoring.db`` carries project rows WITHOUT geographic
coordinates, and we intentionally avoid paid geocoding APIs. This module
supplies:

  * ``STATE_CENTROIDS`` -- official state/UT capital coordinates so any DB
    project state can be placed on the Leaflet map.
  * ``MAP_PROJECTS``  -- 20 realistic demo projects across Indian states/UTs
    that always render even if the backend is empty or offline.
  * ``coordinates_for()`` -- deterministic pseudo-random jitter around a
    state centroid derived from the project id (same id -> same point).

Nothing here touches the ML models; it is display/demo data only.
"""
from __future__ import annotations

import random
from typing import Dict, List, Optional, Tuple

# State / UT name -> [lat, lng] of the capital / economically-active centre.
STATE_CENTROIDS: Dict[str, List[float]] = {
    "Andaman & Nicobar": [11.667, 92.736],
    "Andhra Pradesh": [16.506, 80.648],
    "Arunachal Pradesh": [27.083, 93.616],
    "Assam": [26.144, 91.736],
    "Bihar": [25.609, 85.123],
    "Chandigarh": [30.733, 76.779],
    "Chhattisgarh": [21.278, 81.866],
    "Dadra & Nagar Haveli and Daman & Diu": [20.398, 72.834],
    "Delhi": [28.704, 77.102],
    "Goa": [15.491, 73.818],
    "Gujarat": [23.242, 72.628],
    "Haryana": [29.058, 76.086],
    "Himachal Pradesh": [31.104, 77.173],
    "Jammu & Kashmir": [33.778, 76.576],
    "Jharkhand": [23.344, 85.315],
    "Karnataka": [12.972, 77.595],
    "Kerala": [8.524, 76.936],
    "Ladakh": [34.153, 77.577],
    "Lakshadweep": [10.578, 72.639],
    "Madhya Pradesh": [23.259, 77.412],
    "Maharashtra": [19.076, 72.878],
    "Manipur": [24.817, 93.937],
    "Meghalaya": [25.578, 91.893],
    "Mizoram": [23.164, 92.938],
    "Nagaland": [25.676, 94.109],
    "Odisha": [20.297, 85.824],
    "Puducherry": [11.941, 79.808],
    "Punjab": [30.901, 75.857],
    "Rajasthan": [26.912, 75.787],
    "Sikkim": [27.339, 88.614],
    "Tamil Nadu": [13.083, 80.270],
    "Telangana": [17.385, 78.487],
    "Tripura": [23.831, 91.287],
    "Uttar Pradesh": [26.846, 80.946],
    "Uttarakhand": [30.316, 78.032],
    "West Bengal": [22.572, 88.364],
}
# Alias normalisation so 'Maharashtra / Gujarat', 'andaman and nicobar islands'
# etc. still resolve to a usable centroid.
STATE_ALIASES: Dict[str, str] = {
    "andaman and nicobar islands": "Andaman & Nicobar",
    "jammu and kashmir": "Jammu & Kashmir",
    "dadra and nagar haveli": "Dadra & Nagar Haveli and Daman & Diu",
    "dadra & nagar haveli": "Dadra & Nagar Haveli and Daman & Diu",
    "daman and diu": "Dadra & Nagar Haveli and Daman & Diu",
    "orissa": "Odisha",
    "pondicherry": "Puducherry",
    "nct of delhi": "Delhi",
    "delhi nct": "Delhi",
}

# 20 realistic demo projects used when the backend map payload is unavailable.
# ``risk_score`` follows the same 0-100 convention as the XGBoost composite.
MAP_PROJECTS: List[dict] = [
    {"id": "DM-MH-001", "name": "Mumbai Coastal Road -- North Extension",
     "state": "Maharashtra", "sector": "Roads & Highways", "lat": 19.012, "lng": 72.831,
     "cost_cr": 12000, "status": "Watch", "risk_score": 52, "risk_level": "Medium",
     "agency": "MMRDA"},
    {"id": "DM-GJ-002", "name": "Vadodara--Mumbai Section, Delhi--Mumbai Expressway",
     "state": "Gujarat", "sector": "Roads & Highways", "lat": 22.301, "lng": 73.183,
     "cost_cr": 9900, "status": "On Track", "risk_score": 31, "risk_level": "Low",
     "agency": "NHAI"},
    {"id": "DM-DL-003", "name": "Delhi Metro Phase-IV Expansion",
     "state": "Delhi", "sector": "Urban Transport", "lat": 28.652, "lng": 77.232,
     "cost_cr": 24948, "status": "On Track", "risk_score": 28, "risk_level": "Low",
     "agency": "DMRC"},
    {"id": "DM-UP-004", "name": "Jewar (Noida) International Airport",
     "state": "Uttar Pradesh", "sector": "Aviation", "lat": 28.191, "lng": 77.650,
     "cost_cr": 29363, "status": "Watch", "risk_score": 48, "risk_level": "Medium",
     "agency": "YIAPL"},
    {"id": "DM-KA-005", "name": "Bengaluru Suburban Railway Project",
     "state": "Karnataka", "sector": "Railways", "lat": 12.987, "lng": 77.594,
     "cost_cr": 15767, "status": "At Risk", "risk_score": 68, "risk_level": "High",
     "agency": "K-RIDE"},
    {"id": "DM-TN-006", "name": "Chennai Metro Rail Phase-II",
     "state": "Tamil Nadu", "sector": "Urban Transport", "lat": 13.083, "lng": 80.270,
     "cost_cr": 63246, "status": "Watch", "risk_score": 55, "risk_level": "Medium",
     "agency": "CMRL"},
    {"id": "DM-WB-007", "name": "Kolkata East--West Metro Corridor",
     "state": "West Bengal", "sector": "Railways", "lat": 22.572, "lng": 88.364,
     "cost_cr": 8965, "status": "At Risk", "risk_score": 72, "risk_level": "High",
     "agency": "KMRC"},
    {"id": "DM-TG-008", "name": "Strategic Road Development Programme (ORR)",
     "state": "Telangana", "sector": "Roads & Highways", "lat": 17.385, "lng": 78.487,
     "cost_cr": 7097, "status": "On Track", "risk_score": 24, "risk_level": "Low",
     "agency": "HMDA"},
    {"id": "DM-RJ-009", "name": "Eastern Rajasthan Canal Project -- Phase 1",
     "state": "Rajasthan", "sector": "Water Resources", "lat": 26.912, "lng": 75.787,
     "cost_cr": 31000, "status": "At Risk", "risk_score": 77, "risk_level": "High",
     "agency": "WRD Rajasthan"},
    {"id": "DM-HR-010", "name": "Kundli--Manesar--Palwal Expressway",
     "state": "Haryana", "sector": "Roads & Highways", "lat": 28.533, "lng": 76.941,
     "cost_cr": 4000, "status": "On Track", "risk_score": 33, "risk_level": "Low",
     "agency": "HSIIDC"},
]
MAP_PROJECTS += [
    {"id": "DM-PB-011", "name": "Punjab Orbital Rail Corridor",
     "state": "Punjab", "sector": "Railways", "lat": 30.901, "lng": 75.857,
     "cost_cr": 2500, "status": "Watch", "risk_score": 45, "risk_level": "Medium",
     "agency": "Rail Land Development Authority"},
    {"id": "DM-BR-012", "name": "Ganga Rail--Road Bridge, Munger",
     "state": "Bihar", "sector": "Railways", "lat": 25.381, "lng": 86.465,
     "cost_cr": 1450, "status": "On Track", "risk_score": 27, "risk_level": "Low",
     "agency": "East Central Railway"},
    {"id": "DM-MP-013", "name": "Bhopal--Indore Expressway",
     "state": "Madhya Pradesh", "sector": "Roads & Highways", "lat": 23.259, "lng": 77.412,
     "cost_cr": 15000, "status": "Watch", "risk_score": 47, "risk_level": "Medium",
     "agency": "MPRDC"},
    {"id": "DM-KL-014", "name": "Kochi Water Metro -- Phase 2",
     "state": "Kerala", "sector": "Urban Transport", "lat": 9.931, "lng": 76.267,
     "cost_cr": 1137, "status": "On Track", "risk_score": 22, "risk_level": "Low",
     "agency": "KMRL"},
    {"id": "DM-AS-015", "name": "Guwahati Urban Mobility Metro",
     "state": "Assam", "sector": "Urban Transport", "lat": 26.144, "lng": 91.736,
     "cost_cr": 9000, "status": "Watch", "risk_score": 56, "risk_level": "Medium",
     "agency": "GMDA"},
    {"id": "DM-OD-016", "name": "Odisha Mineral Metro Corridor",
     "state": "Odisha", "sector": "Railways", "lat": 20.297, "lng": 85.824,
     "cost_cr": 5200, "status": "At Risk", "risk_score": 64, "risk_level": "High",
     "agency": "Odisha MMC"},
    {"id": "DM-AP-017", "name": "Amaravati Capital Region -- Seed Capital Works",
     "state": "Andhra Pradesh", "sector": "Urban Development", "lat": 16.506, "lng": 80.648,
     "cost_cr": 50000, "status": "At Risk", "risk_score": 81, "risk_level": "Critical",
     "agency": "CRDA"},
    {"id": "DM-JH-018", "name": "Deoghar Airport Expansion",
     "state": "Jharkhand", "sector": "Aviation", "lat": 24.441, "lng": 86.700,
     "cost_cr": 4500, "status": "Watch", "risk_score": 42, "risk_level": "Medium",
     "agency": "AAI"},
    {"id": "DM-UK-019", "name": "Char Dham All-Weather Road (Rishikesh--Gangotri)",
     "state": "Uttarakhand", "sector": "Roads & Highways", "lat": 30.087, "lng": 78.294,
     "cost_cr": 12000, "status": "At Risk", "risk_score": 66, "risk_level": "High",
     "agency": "Border Roads Organisation"},
    {"id": "DM-GA-020", "name": "Mopa International Airport -- Phase 2",
     "state": "Goa", "sector": "Aviation", "lat": 15.301, "lng": 73.992,
     "cost_cr": 3400, "status": "On Track", "risk_score": 30, "risk_level": "Low",
     "agency": "GMR Goa Airport"},
]

# Map-project ids declared above, exported so the API can key on them.
MAP_PROJECT_IDS: List[str] = [p["id"] for p in MAP_PROJECTS]


def _normalise_state(state: str) -> str:
    """Return canonical state name (or the raw value when unknown)."""
    if not state:
        return "India"
    key = state.strip().lower()
    # "Maharashtra / Gujarat" -> "Maharashtra"
    if " / " in key:
        key = key.split(" / ")[0].strip()
    key = STATE_ALIASES.get(key, key)
    for name in STATE_CENTROIDS:
        if name.lower() == key:
            return name
    return state.strip()


# Comprehensive district and industrial / infrastructure hubs per State and Union Territory.
# Distributes projects across realistic specific work locations throughout each state,
# preventing unreal clustered clumps at state capitals on the map.
STATE_DISTRICT_HUBS: Dict[str, List[Tuple[str, float, float]]] = {
    "Andaman & Nicobar": [
        ("Port Blair", 11.667, 92.736),
        ("Havelock Island (Swaraj Dweep)", 11.976, 92.987),
        ("Diglipur", 13.267, 92.967),
        ("Mayabunder", 12.933, 92.933),
        ("Car Nicobar", 9.155, 92.766),
    ],
    "Andhra Pradesh": [
        ("Amaravati Capital Region", 16.506, 80.648),
        ("Visakhapatnam Port Corridor", 17.686, 83.218),
        ("Vijayawada Logistics Hub", 16.506, 80.648),
        ("Tirupati Transit Node", 13.628, 79.419),
        ("Guntur Agri-Expressway", 16.306, 80.436),
        ("Kurnool Industrial Node", 15.828, 78.037),
        ("Nellore Coastal Highway", 14.442, 79.986),
        ("Kakinada Deepwater Port", 16.989, 82.247),
        ("Anantapur Defense Corridor", 14.681, 77.600),
        ("Kadapa Mineral Belt", 14.467, 78.824),
    ],
    "Arunachal Pradesh": [
        ("Itanagar Capital Hub", 27.083, 93.616),
        ("Tawang Border Corridor", 27.586, 91.859),
        ("Pasighat Smart City", 28.066, 95.326),
        ("Ziro Valley Road Section", 27.594, 93.838),
        ("Bhalukpong Transit Route", 27.013, 92.646),
        ("Roing Highway Link", 28.140, 95.830),
    ],
    "Assam": [
        ("Guwahati Metropolitan Area", 26.144, 91.736),
        ("Dibrugarh Multi-Modal Hub", 27.472, 94.912),
        ("Silchar Barak Valley Link", 24.833, 92.778),
        ("Jorhat Tea Logistics Park", 26.750, 94.216),
        ("Tezpur Brahmaputra Corridor", 26.633, 92.793),
        ("Nagaon Central Highway", 26.346, 92.684),
        ("Bongaigaon Refinery Junction", 26.479, 90.558),
        ("Tinsukia Freight Terminal", 27.492, 95.346),
    ],
    "Bihar": [
        ("Patna Ring Road & Metro", 25.609, 85.123),
        ("Gaya Pilgrim Rail Node", 24.795, 85.000),
        ("Muzaffarpur North Highway", 26.120, 85.364),
        ("Bhagalpur Silk City Expressway", 25.242, 86.984),
        ("Darbhanga Airport & Transit", 26.154, 85.891),
        ("Purnia Seemanchal Corridor", 25.777, 87.475),
        ("Begusarai Industrial Belt", 25.418, 86.127),
        ("Barauni Refinery & Energy Node", 25.474, 85.975),
        ("Chhapra Saran Rail Complex", 25.784, 84.727),
    ],
    "Chandigarh": [
        ("Sector 17 City Centre", 30.739, 76.782),
        ("IT Park Manimajra", 30.724, 76.848),
        ("Mohali Border Expressway", 30.704, 76.717),
        ("Industrial Area Phase 1", 30.707, 76.802),
    ],
    "Chhattisgarh": [
        ("Raipur Capital Logistics Hub", 21.251, 81.629),
        ("Nava Raipur Atal Nagar", 21.161, 81.787),
        ("Bhilai Steel City Corridor", 21.193, 81.350),
        ("Bilaspur High Court & Rail Zone", 22.079, 82.140),
        ("Korba Thermal Power Belt", 22.359, 82.684),
        ("Jagdalpur Bastar Transit Corridor", 19.074, 82.008),
        ("Raigarh Coal-Steel Expressway", 21.897, 83.395),
        ("Durg Bypass & Rail Flyover", 21.190, 81.284),
    ],
    "Dadra & Nagar Haveli and Daman & Diu": [
        ("Daman Coastal Infrastructure", 20.398, 72.834),
        ("Silvassa Industrial Estate", 20.276, 73.008),
        ("Diu Tourism Port Works", 20.714, 70.987),
        ("Dadra Manufacturing Park", 20.320, 72.970),
    ],
    "Delhi": [
        ("Central Vista & Connaught Place", 28.613, 77.209),
        ("Dwarka Expressway Corridor", 28.592, 77.046),
        ("Rohini North Delhi Expansion", 28.749, 77.067),
        ("Okhla Industrial & Metro Phase IV", 28.535, 77.273),
        ("Narela Multi-Modal Sub-City", 28.853, 77.093),
        ("Mayur Vihar Transit Junction", 28.608, 77.297),
        ("Aerocity Transit Terminal", 28.556, 77.120),
        ("Najafgarh Urban Freight Node", 28.609, 76.985),
    ],
    "Goa": [
        ("Panaji Mandovi Promenade", 15.491, 73.818),
        ("Mormugao Port Trust Rail Link", 15.412, 73.805),
        ("Margao South Goa Transit Node", 15.273, 73.958),
        ("Mopa (Manohar) Airport Corridor", 15.753, 73.864),
        ("Vasco da Gama Industrial Spine", 15.399, 73.811),
        ("Ponda Central Arterial Road", 15.402, 74.015),
    ],
    "Gujarat": [
        ("Gandhinagar GIFT City & Metro", 23.215, 72.684),
        ("Ahmedabad Ring Road & Sabarmati", 23.022, 72.571),
        ("Surat Diamond Bourse & Metro", 21.170, 72.831),
        ("Vadodara Expressway Node", 22.307, 73.181),
        ("Rajkot AIIMS & Industrial Corridor", 22.303, 70.802),
        ("Bhavnagar Coastal Port Highway", 21.764, 72.151),
        ("Jamnagar Refining & Port Complex", 22.470, 70.057),
        ("Kandla-Gandhidham Freight Terminal", 23.075, 70.133),
        ("Mundra Port Special Economic Zone", 22.838, 69.721),
        ("Bharuch-Dahej Petrochem PCPIR", 21.705, 72.995),
        ("Mehsana North Highway Corridor", 23.588, 72.369),
    ],
    "Haryana": [
        ("Gurugram Cyber City & CPR", 28.459, 77.026),
        ("Faridabad Smart City Corridor", 28.408, 77.317),
        ("Panipat Refinery & Textile Node", 29.390, 76.963),
        ("Ambala Multi-Track Railway Junction", 30.378, 76.776),
        ("Hisar Greenfield Airport Zone", 29.149, 75.721),
        ("Rohtak Transit & Industrial Park", 28.895, 76.606),
        ("Karnal GT Road Section", 29.685, 76.990),
        ("Sonipat Kundli Logistics Park", 28.993, 77.019),
        ("Manesar Industrial Corridor", 28.358, 76.936),
    ],
    "Himachal Pradesh": [
        ("Shimla Mountain Tunnel & Bypass", 31.104, 77.173),
        ("Dharamshala Smart Hill Corridor", 32.219, 76.323),
        ("Kullu-Manali Tunnel Access Road", 32.239, 77.188),
        ("Mandi Hydro-Electric Highway Node", 31.708, 76.932),
        ("Solan Industrial Corridor (Baddi)", 30.957, 76.791),
        ("Bilaspur Bhanupali Railway Link", 31.343, 76.757),
        ("Una Broad-Gauge Railway Section", 31.468, 76.271),
        ("Kangra Valley Infrastructure Node", 32.099, 76.269),
    ],
    "Jammu & Kashmir": [
        ("Srinagar Smart City & Ring Road", 34.083, 74.797),
        ("Jammu Tawi Rail & Airport Hub", 32.726, 74.857),
        ("Anantnag South Kashmir Corridor", 33.731, 75.148),
        ("Baramulla Border Railway Extension", 34.200, 74.343),
        ("Udhampur-Srinagar-Baramulla Link", 32.926, 75.141),
        ("Banihal Qazigund Tunnel Section", 33.551, 75.201),
        ("Katra Vaishno Devi Transit Terminal", 32.993, 74.931),
    ],
    "Jharkhand": [
        ("Ranchi Ring Road & Smart Sub-City", 23.344, 85.315),
        ("Jamshedpur Steel Manufacturing Spine", 22.804, 86.202),
        ("Dhanbad Coalfield Rail Infrastructure", 23.795, 86.430),
        ("Bokaro Thermal & Steel Industrial Zone", 23.669, 86.151),
        ("Deoghar International Airport Node", 24.441, 86.700),
        ("Hazaribagh North Plateau Expressway", 23.993, 85.362),
        ("Ramgarh Freight & Coal Transit Hub", 23.630, 85.514),
        ("Giridih Rail Section", 24.186, 86.302),
    ],
    "Karnataka": [
        ("Bengaluru Peripheral Ring Road & Metro", 12.972, 77.595),
        ("Mysuru-Bengaluru Expressway Corridor", 12.295, 76.639),
        ("Hubballi-Dharwad Industrial Node", 15.364, 75.124),
        ("Mangaluru Coastal Port & Highway", 12.914, 74.856),
        ("Belagavi Industrial & Rail Hub", 15.849, 74.497),
        ("Kalaburagi Airport & Cement Corridor", 17.329, 76.834),
        ("Ballari Steel & Mining Corridor", 15.139, 76.921),
        ("Tumakuru Industrial Smart City", 13.340, 77.100),
        ("Shivamogga Domestic Airport Zone", 13.929, 75.568),
        ("Davangere Textile-Transit Node", 14.464, 75.921),
    ],
    "Kerala": [
        ("Thiruvananthapuram Vizhinjam Port Corridor", 8.524, 76.936),
        ("Kochi Water Metro & Container Transhipment", 9.931, 76.267),
        ("Kozhikode Malabar Transit Highway", 11.258, 75.780),
        ("Thrissur Cultural & Rail Junction", 10.527, 76.214),
        ("Kannur International Airport Node", 11.874, 75.370),
        ("Kollam Inland Waterway Terminal", 8.893, 76.614),
        ("Palakkad Industrial Corridor & Gap", 10.786, 76.654),
        ("Alappuzha Coastal Elevated Highway", 9.498, 76.338),
    ],
    "Ladakh": [
        ("Leh High-Altitude Infrastructure Hub", 34.153, 77.577),
        ("Kargil Strategic Road Section", 34.553, 76.134),
        ("Zojila Tunnel Strategic Portal", 34.288, 75.485),
        ("Diskit Nubra Valley Infrastructure", 34.542, 77.562),
    ],
    "Lakshadweep": [
        ("Kavaratti Island Port Infrastructure", 10.578, 72.639),
        ("Agatti Aerodrome Expansion", 10.828, 72.176),
        ("Andrott Island Marine Terminal", 10.816, 73.666),
    ],
    "Madhya Pradesh": [
        ("Bhopal Smart Capital & Metro", 23.259, 77.412),
        ("Indore Super Corridor & Metro", 22.719, 75.857),
        ("Jabalpur Narmada Highway Node", 23.181, 79.986),
        ("Gwalior Heritage Transit & Airport", 26.218, 78.182),
        ("Ujjain Mahakal Corridor & Highway", 23.176, 75.788),
        ("Sagar Bundelkhand Link Highway", 23.838, 78.737),
        ("Rewa Solar Park & Rail Terminal", 24.536, 81.303),
        ("Satna Cement & Mining Spine", 24.600, 80.832),
        ("Katni Multi-Track Railway Junction", 23.834, 80.399),
        ("Singrauli Energy Capital Belt", 24.199, 82.664),
    ],
    "Maharashtra": [
        ("Mumbai Coastal Road & Trans-Harbour Link", 18.922, 72.834),
        ("Navi Mumbai International Airport Zone", 18.990, 73.072),
        ("Pune Ring Road & Hinjawadi Metro", 18.520, 73.856),
        ("Nagpur Samruddhi Mahamarg & Metro", 21.145, 79.088),
        ("Nashik Industrial & Defense Corridor", 19.997, 73.789),
        ("Chhatrapati Sambhaji Nagar (Aurangabad) DMIC", 19.876, 75.343),
        ("Solapur Smart City & Textile Hub", 17.659, 75.906),
        ("Kolhapur Western Ghats Expressway", 16.705, 74.243),
        ("Amravati Textile Park & Bypass", 20.932, 77.752),
        ("Ratnagiri Coastal Port Infrastructure", 16.990, 73.312),
        ("Nanded Gurudwara Transit Node", 19.138, 77.321),
        ("Jalgaon Multi-Modal Rail Corridor", 21.007, 75.562),
        ("Chandrapur Thermal & Mining Complex", 19.961, 79.296),
    ],
    "Manipur": [
        ("Imphal Valley Ring Road & Airport", 24.817, 93.937),
        ("Jiribam-Imphal Railway Link", 24.802, 93.125),
        ("Churachandpur Transit Corridor", 24.333, 93.677),
        ("Thoubal Multi-Purpose River Works", 24.638, 94.004),
    ],
    "Meghalaya": [
        ("Shillong Smart Hill Expressway", 25.578, 91.893),
        ("Tura Garo Hills Road Corridor", 25.514, 90.220),
        ("Jowai Jaintia Hills Coal Spine", 25.448, 92.203),
        ("Nongpoh National Highway Section", 25.902, 91.880),
        ("Dawki Integrated Check Post Route", 25.187, 92.018),
    ],
    "Mizoram": [
        ("Aizawl Capital Mobility Project", 23.727, 92.717),
        ("Bairabi-Sairang Rail Terminal", 23.805, 92.658),
        ("Lunglei Southern Highway Link", 22.888, 92.738),
        ("Champhai Indo-Myanmar Border Road", 23.475, 93.328),
    ],
    "Nagaland": [
        ("Kohima Capital Smart Infrastructure", 25.675, 94.108),
        ("Dimapur Multi-Modal Logistics Hub", 25.906, 93.727),
        ("Mokokchung Central Highway", 26.326, 94.520),
        ("Mon Northern Border Road Node", 26.742, 95.056),
    ],
    "Odisha": [
        ("Bhubaneswar Smart Capital & Metro", 20.296, 85.824),
        ("Cuttack Mahanadi Riverfront Corridor", 20.462, 85.882),
        ("Rourkela Steel City Infrastructure", 22.260, 84.853),
        ("Paradip Deep Sea Port Rail Link", 20.316, 86.611),
        ("Dhamra Port Freight Corridor", 20.803, 86.963),
        ("Berhampur South Odisha Transit Spine", 19.315, 84.794),
        ("Sambalpur Hirakud Industrial Belt", 21.466, 83.981),
        ("Jharsuguda Airport & Power Hub", 21.855, 84.006),
        ("Angul-Talcher Coal-Steel Corridor", 20.840, 85.101),
        ("Koraput Mineral Railway Section", 18.813, 82.711),
    ],
    "Puducherry": [
        ("Puducherry Coastal Promenade & Port", 11.941, 79.808),
        ("Karaikal Deep Water Port Corridor", 10.925, 79.838),
        ("Mahe Riverfront Transit Route", 11.700, 75.534),
        ("Yanam Godavari Marine Hub", 16.733, 82.217),
    ],
    "Punjab": [
        ("Chandigarh-Mohali Sub-City Corridor", 30.704, 76.717),
        ("Ludhiana Industrial Metro & Elevated Road", 30.901, 75.857),
        ("Amritsar Golden Temple Mass Transit", 31.634, 74.872),
        ("Jalandhar Grand Trunk Road Expansion", 31.326, 75.576),
        ("Bathinda AIIMS & Refinery Transit Hub", 30.211, 74.945),
        ("Patiala Heritage Bypass & Rail Line", 30.339, 76.386),
        ("Pathankot Border Infrastructure Node", 32.268, 75.652),
        ("Hoshiarpur Multi-Lane Highway", 31.527, 75.911),
    ],
    "Rajasthan": [
        ("Jaipur Ring Road & Metro Phase II", 26.912, 75.787),
        ("Jodhpur Solar Corridor & Airport", 26.238, 73.024),
        ("Kota Chambal Riverfront & Power Hub", 25.213, 75.864),
        ("Udaipur Smart Tourism & Expressway", 24.585, 73.712),
        ("Bhiwadi-Neemrana DMIC Industrial Hub", 28.210, 76.840),
        ("Ajmer-Pushkar Transit Corridor", 26.449, 74.639),
        ("Bikaner Solar & Border Highway", 28.022, 73.311),
        ("Barmer Refinery & Petrochemical Complex", 25.753, 71.418),
        ("Alwar Delhi-NCR Regional Transit System", 27.553, 76.634),
        ("Bhilwara Textile Industrial Belt", 25.346, 74.636),
    ],
    "Sikkim": [
        ("Gangtok Ropeway & Smart Transit", 27.339, 88.614),
        ("Pakyong Greenfield Airport Corridor", 27.234, 88.586),
        ("Namchi South Sikkim Infrastructure", 27.166, 88.366),
        ("Rangpo-Sivok Railway Link Portal", 27.176, 88.528),
        ("Mangan North Mountain Highway", 27.508, 88.529),
    ],
    "Tamil Nadu": [
        ("Chennai Metro Rail Phase II & Port Expressway", 13.083, 80.270),
        ("Coimbatore Western Ring Road & IT Corridor", 11.016, 76.955),
        ("Madurai Elevated Highway & AIIMS Site", 9.925, 78.119),
        ("Tiruchirappalli Multi-Modal Airport Hub", 10.790, 78.704),
        ("Salem Defense Industrial Corridor", 11.664, 78.146),
        ("Thoothukudi VO Chidambaranar Port Hub", 8.764, 78.134),
        ("Tirunelveli Solar & Highway Spine", 8.713, 77.756),
        ("Tiruppur Export Freight Terminal", 11.108, 77.341),
        ("Erode Industrial Bypass", 11.341, 77.717),
        ("Hosur Industrial & Electronics SEZ", 12.740, 77.825),
        ("Vellore Golden Quad Highway", 12.916, 79.132),
    ],
    "Telangana": [
        ("Hyderabad Regional Ring Road & Metro", 17.385, 78.487),
        ("Warangal Kakatiya Mega Textile Park", 17.968, 79.594),
        ("Karimnagar Smart City Highway", 18.438, 79.128),
        ("Nizamabad Agricultural Logistics Hub", 18.672, 78.094),
        ("Khammam Granites Freight Corridor", 17.247, 80.151),
        ("Ramagundam Fertilizer & Thermal Complex", 18.802, 79.467),
        ("Mahbubnagar Pharma SEZ & Highway", 16.748, 77.989),
        ("Siddipet Rail Link & Transit Node", 18.101, 78.852),
    ],
    "Tripura": [
        ("Agartala Smart Capital & Akhaura Rail", 23.831, 91.287),
        ("Udaipur Gomati Transit Link", 23.534, 91.488),
        ("Dharmanagar Broad Gauge Rail Depot", 24.375, 92.164),
        ("Sabroom Multi-Modal Special Economic Zone", 23.003, 91.733),
        ("Kailashahar Border Infrastructure Hub", 24.329, 92.006),
    ],
    "Uttar Pradesh": [
        ("Noida-Greater Noida & Jewar International Airport", 28.191, 77.650),
        ("Lucknow Outer Ring Road & Metro", 26.846, 80.946),
        ("Kanpur Industrial Metro & Highway Corridor", 26.449, 80.331),
        ("Varanasi Multi-Modal Terminal & Ring Road", 25.317, 82.973),
        ("Prayagraj Kumbh Transit & Ganga Expressway", 25.435, 81.846),
        ("Agra Metro & Yamuna Expressway Expansion", 27.176, 78.008),
        ("Gorakhpur AIIMS & Purvanchal Link Expressway", 26.760, 83.373),
        ("Bareilly Smart City & Airport Terminal", 28.367, 79.430),
        ("Meerut Delhi-Meerut Rapid Rail (RRTS)", 28.984, 77.706),
        ("Aligarh Defense Industrial Corridor Node", 27.897, 78.088),
        ("Moradabad Freight & Export Highway", 28.838, 78.776),
        ("Jhansi Bundelkhand Defense Node & Expressway", 25.448, 78.568),
        ("Ayodhya Airport & Ram Mandir Transit Spine", 26.792, 82.199),
        ("Mathura-Vrindavan Heritage Transit", 27.492, 77.673),
        ("Saharanpur Western Dedicated Freight Corridor", 29.964, 77.546),
    ],
    "Uttarakhand": [
        ("Dehradun Capital Smart Mobility Hub", 30.316, 78.032),
        ("Haridwar Industrial Estate & Rail Corridor", 29.945, 78.164),
        ("Rishikesh-Karnaprayag Mountain Rail Section", 30.086, 78.267),
        ("Nainital High-Altitude Eco-Corridor", 29.391, 79.454),
        ("Haldwani Kathgodam Multi-Modal Hub", 29.218, 79.513),
        ("Rudrapur SIDCUL Manufacturing Expressway", 28.980, 79.400),
        ("Roorkee National Highway & Canal Works", 29.854, 77.888),
        ("Almora Kumaon Ridge Highway", 29.597, 79.659),
        ("Pithoragarh Border Highway Section", 29.582, 80.218),
        ("Chamoli-Gopeshwar Char Dham Package", 30.407, 79.328),
        ("Tehri Garhwal Hydro & Tunnel Corridor", 30.378, 78.480),
        ("Kashipur Industrial Transit Node", 29.210, 78.961),
    ],
    "West Bengal": [
        ("Kolkata East-West Metro & Port Trust", 22.572, 88.364),
        ("New Town & Rajarhat Smart City Spine", 22.585, 88.483),
        ("Howrah Rail Terminus & Elevated Viaducts", 22.595, 78.263),
        ("Siliguri North Bengal Multi-Modal Hub", 26.727, 88.395),
        ("Durgapur Steel & Aerotropolis Corridor", 23.520, 87.311),
        ("Asansol Multi-Track Rail Infrastructure", 23.673, 86.952),
        ("Haldia Petrochem Port & Navigation Terminal", 22.066, 88.069),
        ("Kharagpur Railway Freight Junction & IIT Park", 22.346, 87.231),
        ("Malda Northern Transit & Mango Corridor", 25.010, 88.141),
        ("Bardhaman Grand Trunk Railway Node", 23.232, 87.861),
    ],
}


def _normalise_state(state: str) -> str:
    """Return canonical state name (or the raw value when unknown)."""
    if not state:
        return "India"
    key = state.strip().lower()
    # "Maharashtra / Gujarat" -> "Maharashtra"
    if " / " in key:
        key = key.split(" / ")[0].strip()
    key = STATE_ALIASES.get(key, key)
    for name in STATE_CENTROIDS:
        if name.lower() == key:
            return name
    return state.strip()


def get_state_centroid(state: str) -> Optional[List[float]]:
    """Return [lat, lng] for a state name or None when unknown."""
    return STATE_CENTROIDS.get(_normalise_state(state))


def get_state_hubs(state: str) -> List[Tuple[str, float, float]]:
    """Return list of district/project hubs for a given state name."""
    canonical = _normalise_state(state)
    return STATE_DISTRICT_HUBS.get(canonical, [])


def coordinates_for(project_id: str, state: str) -> Optional[Tuple[float, float]]:
    """Deterministic (lat, lng) for a project id across realistic district work sites.

    Instead of clustering all projects in a single capital centroid, projects are
    deterministically assigned to real district/city hubs across the state geometry,
    with a small localized jitter around the specific project site.
    """
    hubs = get_state_hubs(state)
    rng = random.Random(f"{project_id}::{state}")
    if hubs:
        # Assign to a specific district hub deterministically
        hub_name, h_lat, h_lng = rng.choice(hubs)
        lat = h_lat + rng.uniform(-0.06, 0.06)
        lng = h_lng + rng.uniform(-0.06, 0.06)
    else:
        centroid = get_state_centroid(state)
        if centroid is None:
            return None
        lat = centroid[0] + rng.uniform(-0.25, 0.25)
        lng = centroid[1] + rng.uniform(-0.25, 0.25)

    # Keep inside approximate Indian landmass boundaries.
    lat = max(6.0, min(37.5, lat))
    lng = max(68.0, min(97.5, lng))
    return round(lat, 6), round(lng, 6)


def get_district_for(project_id: str, state: str) -> str:
    """Return the specific district/work site location name for a project."""
    hubs = get_state_hubs(state)
    if not hubs:
        return _normalise_state(state)
    rng = random.Random(f"{project_id}::{state}")
    hub_name, _, _ = rng.choice(hubs)
    return hub_name


def map_demo_projects() -> List[dict]:
    """Deep copy of the built-in demo set (so callers can mutate safely)."""
    return [{**p} for p in MAP_PROJECTS]


def demo_by_id(project_id: str) -> Optional[dict]:
    """Return the built-in demo project matching an id, if any."""
    for p in MAP_PROJECTS:
        if p["id"] == project_id or p["id"] == project_id.upper():
            return p
    return None


# --------------------------------------------------------------------------- #
# Contractors & Geofence Lamina Directory
# --------------------------------------------------------------------------- #

CONTRACTORS: List[dict] = [
    {
        "contractor_id": "CNT-LT-01",
        "company_name": "Larsen & Toubro Heavy Civil Infra",
        "contact_person": "S. Ramanathan (VP Projects)",
        "email": "ramanathan.s@lntecc.com",
        "phone": "+91 22 6752 5656",
        "rating": 4.8,
        "active_contracts": 6,
    },
    {
        "contractor_id": "CNT-AF-02",
        "company_name": "Afcons Infrastructure Limited",
        "contact_person": "Rajiv K. Menon (Chief Eng)",
        "email": "ops.infra@afcons.com",
        "phone": "+91 22 6719 1000",
        "rating": 4.6,
        "active_contracts": 5,
    },
    {
        "contractor_id": "CNT-TP-03",
        "company_name": "Tata Projects Limited",
        "contact_person": "Ananya Sharma (Project Director)",
        "email": "asharma@tataprojects.com",
        "phone": "+91 40 6623 8800",
        "rating": 4.7,
        "active_contracts": 5,
    },
    {
        "contractor_id": "CNT-DB-04",
        "company_name": "Dilip Buildcon Limited",
        "contact_person": "Rohan Suryavanshi (Exec Director)",
        "email": "highways@dilipbuildcon.co.in",
        "phone": "+91 755 402 9999",
        "rating": 4.4,
        "active_contracts": 4,
    },
    {
        "contractor_id": "CNT-ME-05",
        "company_name": "Megha Engineering & Infrastructures Ltd",
        "contact_person": "V. K. Reddy (Director Ops)",
        "email": "vkreddy@meil.in",
        "phone": "+91 40 4433 6700",
        "rating": 4.5,
        "active_contracts": 4,
    },
]

# Explicit showcase assignments (others resolved deterministically)
EXPLICIT_ASSIGNMENTS: Dict[str, str] = {
    "INF-2026-MH-892": "CNT-LT-01",
    "DM-MH-001": "CNT-LT-01",
    "DM-DL-003": "CNT-LT-01",
    "PRJ-0001": "CNT-LT-01",
    "PRJ-0006": "CNT-LT-01",
    "PRJ-0011": "CNT-LT-01",
    "INF-2026-DL-412": "CNT-AF-02",
    "DM-GJ-002": "CNT-AF-02",
    "DM-KA-005": "CNT-AF-02",
    "PRJ-0002": "CNT-AF-02",
    "PRJ-0007": "CNT-AF-02",
    "INF-2026-UP-184": "CNT-TP-03",
    "DM-UP-004": "CNT-TP-03",
    "DM-TN-006": "CNT-TP-03",
    "PRJ-0003": "CNT-TP-03",
    "PRJ-0008": "CNT-TP-03",
    "INF-2026-GJ-771": "CNT-DB-04",
    "DM-WB-007": "CNT-DB-04",
    "DM-HR-010": "CNT-DB-04",
    "PRJ-0004": "CNT-DB-04",
    "PRJ-0009": "CNT-DB-04",
    "INF-2026-KL-308": "CNT-ME-05",
    "DM-TG-008": "CNT-ME-05",
    "DM-RJ-009": "CNT-ME-05",
    "PRJ-0005": "CNT-ME-05",
    "PRJ-0010": "CNT-ME-05",
}


def get_contractor(contractor_id: str) -> Optional[dict]:
    """Return contractor record by ID."""
    for c in CONTRACTORS:
        if c["contractor_id"].upper() == contractor_id.upper():
            return {**c}
    return None


def get_contractor_for_project(project_id: str) -> dict:
    """Return the assigned contractor for any project (DB lookup with fallback)."""
    import sqlite3, os
    pid_norm = project_id.strip()
    if os.path.exists("project_monitoring.db"):
        try:
            conn = sqlite3.connect("project_monitoring.db")
            cur = conn.cursor()
            cur.execute("SELECT contractor_id FROM contractor_assignments WHERE project_id = ?", (pid_norm,))
            row = cur.fetchone()
            conn.close()
            if row and row[0]:
                c = get_contractor(row[0])
                if c:
                    return c
        except Exception:
            pass

    if pid_norm in EXPLICIT_ASSIGNMENTS:
        cid = EXPLICIT_ASSIGNMENTS[pid_norm]
        c = get_contractor(cid)
        if c:
            return c
    # Fallback to seeded hash
    idx = abs(hash(pid_norm)) % len(CONTRACTORS)
    return {**CONTRACTORS[idx]}


def geofence_for_project(project_id: str, state: str = "Maharashtra", radius_km: float = 3.5) -> dict:
    """Generate or retrieve designated construction area lamina for a project.

    Returns dict with center_lat, center_lng, radius_km, and boundary polygon vertices.
    """
    import sqlite3, json, os
    if os.path.exists("project_monitoring.db"):
        try:
            conn = sqlite3.connect("project_monitoring.db")
            cur = conn.cursor()
            cur.execute("SELECT center_lat, center_lng, radius_km, boundary_geojson FROM project_geofences WHERE project_id = ?", (project_id,))
            row = cur.fetchone()
            conn.close()
            if row:
                c_lat, c_lng, r_km, bg_json = row
                bg = json.loads(bg_json) if isinstance(bg_json, str) else bg_json
                coords = bg.get("coordinates", [[]])[0]
                poly = [[pt[1], pt[0]] for pt in coords[:-1]] if coords else []
                return {
                    "project_id": project_id,
                    "center_lat": float(c_lat),
                    "center_lng": float(c_lng),
                    "radius_km": float(r_km),
                    "boundary_lamina": poly,
                    "boundary_geojson": bg,
                }
        except Exception:
            pass

    coords = None
    demo = demo_by_id(project_id)
    if demo:
        coords = (demo["lat"], demo["lng"])
    else:
        coords = coordinates_for(project_id, state)
    if coords is None:
        centroid = get_state_centroid(state) or [20.5937, 78.9629]
        coords = (centroid[0], centroid[1])

    center_lat, center_lng = coords
    from verification_pipeline import generate_lamina_polygon
    polygon = generate_lamina_polygon(center_lat, center_lng, radius_km=radius_km, vertices=6)

    return {
        "project_id": project_id,
        "center_lat": center_lat,
        "center_lng": center_lng,
        "radius_km": radius_km,
        "boundary_lamina": polygon,
        "boundary_geojson": {
            "type": "Polygon",
            "coordinates": [[[pt[1], pt[0]] for pt in polygon] + [[polygon[0][1], polygon[0][0]]]]
        },
    }