# Public Free Suffix: Free Domain Name For Everyone

**Public Free Suffix** is a non-profit, free subdomain service designed to empower various communities. We believe in providing accessible resources for:

* **Developers:** Perfect for project testing, staging environments, and personal development sandboxes.
* **Students:** Ideal for academic research, class projects, and learning new technologies without cost barriers.
* **Technicians:** An excellent resource for computer and network technology research, lab setups, and experimenting with new configurations.
* **Personal Users:** Host your personal blog, portfolio, or small passion project within our compliant framework.

Anyone can register and obtain their free domain from here and no need renew it annually. The suffixes currently providing services are as follows (sld):
```text
no.kg
```
## How do I register a domain name?

[Acceptable Use Policy](agreements/acceptable-use-policy.md) | 
[Privacy Policy](agreements/privacy-policy.md) | 
[Registration And Use Agreement](agreements/registration-and-use-agreement-sokg.md) | 
[Reserved Words List](reserved_words.txt)

1. Clone the repository:
```bash
git clone https://github.com/PublicFreeSuffix/PublicFreeSuffix.git
```
2. Choose avaliable domain name, and create a new whois file into `./whois/{your-new-domain-name}.json` folder:
```json
{
  "registrant": "your-own-example@gmail.com",
  "domain": "mynewdomain",
  "sld": "so.kg",
  "nameservers": [
    "nameserver1.example.com",
    "nameserver2.example.com",
    "nameserver3.example.com",
    "nameserver4.example.com"
  ],
  "agree_to_agreements": {
    "registration_and_use_agreement": true,
    "acceptable_use_policy": true,
    "privacy_policy": true
  }
}
```
- `registrant`: The email address of the domain owner.
- `domain`: The domain name without the top-level domain (e.g., "mynewdomain"), domain length must more than 3 chars.
- `nameservers`: A list of DNS servers responsible for resolving the domain, 2 - 4 servers are allowed.
- `agree_to_agreements`: A boolean value indicating whether the user has agreed to the registration and use agreement, acceptable use policy, and privacy policy.
- The name of this file must be `{your-new-domain-name}.json`, like `mynewdomain.so.kg.json` here.


> **Notice** In order to improve utilization and prevent hoarding of registrations and waste of resources, your registered domain name will be revoked if it is detected that no website content has been deployed within 30 consecutive days.

3. Create a pull request with your new domain name and whois file, the Title of Your Pull Request Must be one of.
```text
Registration: {your-new-domain-name}.{sld}
```
```text
Update: {your-new-domain-name}.{sld}
```
```text
Remove: {your-new-domain-name}.{sld}
```
A single Pull Request is only allowed to submit one domain name registration request.
4. Use the registrant email address to send email to `publicfreesuffix@gmail.com` and wait for setup, email title must same as your Pull Request, and content must as.
```text
Domain Name:
Pull Request URL:
```
5. After the domain is set up, you can use it for your website or other purposes.

## How do I update my domain's NS / registrant email?
1. Please modify your whois file and create a new pull request.
2. Use the registrant email address to send email to `publicfreesuffix@gmail.com` with same content and wait for update.
3. (If it's an update for registrant email request)Use the new registrant email address to send the same email `publicfreesuffix@gmail.com`.