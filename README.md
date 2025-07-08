# SO.KG: Free Shared Domain Suffix Registration

---

## What is SOKG Registry?

**SOKG Registry** is a non-profit, free subdomain service designed to empower various communities. We believe in providing accessible resources for:

* **Developers:** Perfect for project testing, staging environments, and personal development sandboxes.
* **Students:** Ideal for academic research, class projects, and learning new technologies without cost barriers.
* **Technicians:** An excellent resource for computer and network technology research, lab setups, and experimenting with new configurations.
* **Personal Users:** Host your personal blog, portfolio, or small passion project within our compliant framework.

Anyone can register and obtain their free domain from here and renew it annually at no cost.

## How do I register a domain name?

1. Clone the repository:
```bash
git clone https://github.com/SOKGNet/SOKGDomain.git
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
- `domain`: The domain name without the top-level domain (e.g., "mynewdomain").
- `nameservers`: A list of DNS servers responsible for resolving the domain, 2 - 4 servers are allowed.
- `agree_to_agreements`: A boolean value indicating whether the user has agreed to the registration and use agreement, acceptable use policy, and privacy policy.
- The name of this file must be `{your-new-domain-name}.json`, like `mynewdomain.so.kg.json` here.

3. Create a pull request with your new domain name and whois file.
4. Use the registrant email address to send and email to `sokgregistry@gmail.com` and wait for setup.
```text
Domain Name:
Pull Request URL:
```
5. After the domain is set up, you can use it for your website or other purposes.